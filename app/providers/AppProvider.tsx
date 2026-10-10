'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BusMessage, DeliveryRecord, DoorEvent, Expectation, LockState } from '@/lib/types'
import { useStatus, type AppStatus } from '../hooks/useStatus'
import { shouldAlert } from '../utils/feed'
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

  const handleMessage = useCallback((msg: BusMessage) => {
    if (msg.kind === 'event') {
      setEvents((list) => upsert(list, msg.event, (e) => e.start))
      if (shouldAlert(msg.event, openedAt.current - 5000, alerted.current)) {
        alerted.current.add(msg.event.id)
        setAlert({ key: msg.event.id, event: msg.event })
      }
    } else if (msg.kind === 'delivery') {
      setDeliveries((list) => upsert(list, msg.delivery, (d) => d.at))
      const key = `taken:${msg.delivery.id}`
      if (msg.delivery.status === 'taken' && !alerted.current.has(key)) {
        alerted.current.add(key)
        setAlert({ key, delivery: msg.delivery })
      }
    } else if (msg.kind === 'lock') {
      setLock(msg.lock)
    } else if (msg.kind === 'expectation') {
      setExpectations((list) => upsert(list, msg.expectation, (x) => x.from))
    }
  }, [])

  useEffect(() => {
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
  }, [refresh, handleMessage])

  const dismissAlert = useCallback(() => setAlert(undefined), [])

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
