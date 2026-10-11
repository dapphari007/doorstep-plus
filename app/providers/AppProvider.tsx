'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BusMessage, CameraChange, DeliveryRecord, DoorEvent, Expectation, LockState } from '@/lib/types'
import { useStatus, type AppStatus } from '../hooks/useStatus'
import { alertKindForEvent, isSilent } from '@/lib/alerts'
import { replacesAlert, shouldAlert } from '../utils/feed'
import { fetchJson } from '../utils/format'
import {
  PROFILES,
  isAlertPrefs,
  isProfileId,
  readStored,
  writeStored,
  type AlertPrefs,
  type ProfileId,
} from '../utils/profiles'

export interface AlertItem {
  key: string
  event?: DoorEvent
  delivery?: DeliveryRecord
  /** The quiet "final update" for a finished scene. */
  summary?: boolean
  camera?: CameraChange
}

interface AppState {
  profile: ProfileId
  setProfile: (p: ProfileId) => void
  prefs: AlertPrefs
  setPrefs: (p: AlertPrefs) => void
  events: DoorEvent[]
  deliveries: DeliveryRecord[]
  expectations: Expectation[]
  lock?: LockState
  loaded: boolean
  connected: boolean
  alert?: AlertItem
  dismissAlert: () => void
  /** Show an existing event as an alert again (demo and settings preview). */
  previewAlert: (event: DoorEvent) => void
  refresh: () => Promise<void>
  status?: AppStatus
  serverOffline: boolean
  reloadStatus: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

const MAX_ITEMS = 300

function upsert<T extends { id: string }>(list: T[], item: T, time: (x: T) => number): T[] {
  const next = list.filter((x) => x.id !== item.id)
  next.push(item)
  return next.sort((a, b) => time(b) - time(a)).slice(0, MAX_ITEMS)
}

const CAMERA_CHECK_MS = 60_000

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<ProfileId>('standard')
  const [prefs, setPrefsState] = useState<AlertPrefs>(PROFILES.standard.prefs)
  const [events, setEvents] = useState<DoorEvent[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([])
  const [expectations, setExpectations] = useState<Expectation[]>([])
  const [lock, setLock] = useState<LockState>()
  const [loaded, setLoaded] = useState(false)
  const [connected, setConnected] = useState(false)
  const [alert, setAlert] = useState<AlertItem>()
  const alerted = useRef(new Set<string>())
  const openedAt = useRef(Date.now())
  const { status, offline: serverOffline, reload: reloadStatus } = useStatus()

  useEffect(() => {
    const storedProfile = readStored('dc.profile', isProfileId) ?? 'standard'
    setProfileState(storedProfile)
    setPrefsState(readStored('dc.prefs', isAlertPrefs) ?? PROFILES[storedProfile].prefs)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.profile = profile
  }, [profile])

  const setProfile = useCallback((p: ProfileId) => {
    setProfileState(p)
    setPrefsState(PROFILES[p].prefs)
    writeStored('dc.profile', p)
    writeStored('dc.prefs', PROFILES[p].prefs)
  }, [])

  const setPrefs = useCallback((p: AlertPrefs) => {
    setPrefsState(p)
    writeStored('dc.prefs', p)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [ev, dl, ex] = await Promise.all([
        fetchJson<{ events: DoorEvent[] }>('/api/events?limit=200'),
        fetchJson<{ deliveries: DeliveryRecord[]; lock: LockState }>('/api/deliveries'),
        fetchJson<{ expectations: Expectation[] }>('/api/expectations'),
      ])
      setEvents(ev.events)
      setDeliveries(dl.deliveries)
      setLock(dl.lock)
      setExpectations(ex.expectations)
    } catch {
      // server restarting; the SSE reconnect will call refresh again
    } finally {
      setLoaded(true)
    }
  }, [])

  const showCameraChange = useCallback((camera: CameraChange) => {
    const key = `camera:${camera.deviceId}:${camera.online}:${camera.at}`
    if (alerted.current.has(key)) return
    alerted.current.add(key)
    setAlert({ key, camera })
  }, [])

  const handleMessage = useCallback(
    (msg: BusMessage) => {
      if (msg.kind === 'event') {
        setEvents((list) => upsert(list, msg.event, (e) => e.start))
        const summaryKey = `summary:${msg.event.id}`
        // Scenes that already alerted just get a better title; only quiet scenes notify once at the end.
        const finalWord = !!msg.event.summary && isSilent(alertKindForEvent(msg.event))
        if (finalWord && msg.event.createdAt >= openedAt.current - 5000 && !alerted.current.has(summaryKey)) {
          alerted.current.add(summaryKey)
          const item = { key: summaryKey, event: msg.event, summary: true }
          // Never covers a real alert that is still on screen.
          setAlert((a) => (a && !a.summary ? a : item))
        } else if (shouldAlert(msg.event, openedAt.current - 5000, alerted.current)) {
          alerted.current.add(msg.event.id)
          setAlert({ key: msg.event.id, event: msg.event })
        } else {
          setAlert((a) =>
            a?.event && !a.key.startsWith('preview') && replacesAlert(msg.event, a.event) ? undefined : a,
          )
        }
      } else if (msg.kind === 'delivery') {
        setDeliveries((list) => upsert(list, msg.delivery, (d) => d.at))
        const key = `taken:${msg.delivery.id}`
        if (msg.delivery.status === 'taken' && !alerted.current.has(key)) {
          alerted.current.add(key)
          setAlert({ key, delivery: msg.delivery })
        }
      } else if (msg.kind === 'camera') {
        showCameraChange(msg.camera)
      } else if (msg.kind === 'lock') {
        setLock(msg.lock)
      } else if (msg.kind === 'expectation') {
        setExpectations((list) => upsert(list, msg.expectation, (x) => x.from))
      }
    },
    [showCameraChange],
  )

  const statusLoaded = status !== undefined
  const demo = !!status?.demo
  const ringConnected = !!status?.ring.connected

  // Without webhooks (the Playground), check each minute whether a camera dropped off or came back.
  const lastOnline = useRef<Map<string, boolean>>(new Map())
  useEffect(() => {
    if (!ringConnected || demo) return
    const check = async () => {
      try {
        const { devices } = await fetchJson<{ devices: { id: string; name: string; online: boolean }[] }>(
          '/api/ring/devices',
        )
        for (const d of devices) {
          const before = lastOnline.current.get(d.id)
          lastOnline.current.set(d.id, d.online)
          if (before !== undefined && before !== d.online)
            showCameraChange({ deviceId: d.id, name: d.name, online: d.online, at: Date.now() })
        }
      } catch {
        // Ring unreachable: the status banner already says so
      }
    }
    void check()
    const id = setInterval(() => void check(), CAMERA_CHECK_MS)
    return () => clearInterval(id)
  }, [ringConnected, demo, showCameraChange])
  useEffect(() => {
    // Wait for the status so the read-only demo (no live events) never opens a stream.
    if (!statusLoaded) return
    if (demo) {
      void refresh()
      return
    }
    let source: EventSource | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let closed = false
    const connect = () => {
      source = new EventSource('/api/events/stream')
      source.onopen = () => {
        setConnected(true)
        // Catch up on anything missed while disconnected.
        void refresh()
      }
      source.onerror = () => {
        setConnected(false)
        source?.close()
        if (!closed) retry = setTimeout(connect, 3000)
      }
      source.onmessage = (m) => {
        try {
          handleMessage(JSON.parse(m.data) as BusMessage)
        } catch {
          // ignore malformed messages
        }
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      source?.close()
    }
  }, [refresh, handleMessage, demo, statusLoaded])

  const dismissAlert = useCallback(() => setAlert(undefined), [])
  const previewAlert = useCallback((event: DoorEvent) => setAlert({ key: `preview-${Date.now()}`, event }), [])

  return (
    <AppContext.Provider
      value={{
        profile,
        setProfile,
        prefs,
        setPrefs,
        events,
        deliveries,
        expectations,
        lock,
        loaded,
        connected,
        alert,
        dismissAlert,
        previewAlert,
        refresh,
        status,
        serverOffline,
        reloadStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
