'use client'

// Accessibility profile + live events, deliveries and lock state over SSE.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { BusMessage, DeliveryRecord, DoorEvent, LockState } from '@/lib/types'

export type ProfileId = 'standard' | 'deaf' | 'blind' | 'lowvision'

export interface AlertPrefs {
  flash: boolean
  vibrate: boolean
  speak: boolean
  chime: boolean
}

export const PROFILES: Record<ProfileId, { label: string; blurb: string; prefs: AlertPrefs }> = {
  standard: {
    label: 'Standard',
    blurb: 'Chime and an on-screen card',
    prefs: { flash: false, vibrate: false, speak: false, chime: true },
  },
  deaf: {
    label: 'Deaf / hard of hearing',
    blurb: 'Full-screen colour flashes, vibration and smart-light patterns. No sound needed.',
    prefs: { flash: true, vibrate: true, speak: false, chime: false },
  },
  blind: {
    label: 'Blind',
    blurb: 'Every event is spoken aloud. Press R to repeat the last one.',
    prefs: { flash: false, vibrate: true, speak: true, chime: false },
  },
  lowvision: {
    label: 'Low vision',
    blurb: 'Extra-large, high-contrast text, gentle flashes and speech.',
    prefs: { flash: true, vibrate: false, speak: true, chime: false },
  },
}

export interface AlertRequest {
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
  lock?: LockState
  connected: boolean
  /** Latest thing worth alerting about; AlertLayer reacts to changes. */
  alert?: AlertRequest
  refresh: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside ProfileProvider')
  return ctx
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private mode / blocked storage: preferences just won't persist
  }
}

function upsert<T extends { id: string }>(list: T[], item: T, sortKey: (x: T) => number): T[] {
  const next = list.filter((x) => x.id !== item.id)
  next.push(item)
  return next.sort((a, b) => sortKey(b) - sortKey(a)).slice(0, 300)
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ProfileId>('standard')
  const [prefs, setPrefsState] = useState<AlertPrefs>(PROFILES.standard.prefs)
  const [events, setEvents] = useState<DoorEvent[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([])
  const [lock, setLock] = useState<LockState>()
  const [connected, setConnected] = useState(false)
  const [alert, setAlert] = useState<AlertRequest>()
  const alerted = useRef(new Set<string>())
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    const p = readStorage<ProfileId>('dc.profile', 'standard')
    setProfileState(p)
    setPrefsState(readStorage<AlertPrefs>('dc.prefs', PROFILES[p].prefs))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.profile = profile
  }, [profile])

  const setProfile = useCallback((p: ProfileId) => {
    setProfileState(p)
    setPrefsState(PROFILES[p].prefs)
    writeStorage('dc.profile', p)
    writeStorage('dc.prefs', PROFILES[p].prefs)
  }, [])

  const setPrefs = useCallback((p: AlertPrefs) => {
    setPrefsState(p)
    writeStorage('dc.prefs', p)
  }, [])

  const refresh = useCallback(async () => {
    const [ev, dl] = await Promise.all([
      fetch('/api/events?limit=200').then((r) => r.json()),
      fetch('/api/deliveries').then((r) => r.json()),
    ])
    setEvents(ev.events || [])
    setDeliveries(dl.deliveries || [])
    setLock(dl.lock)
  }, [])

  useEffect(() => {
    void refresh()
    let source: EventSource | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      source = new EventSource('/api/events/stream')
      source.onopen = () => setConnected(true)
      source.onerror = () => {
        setConnected(false)
        source?.close()
        retry = setTimeout(connect, 3000)
      }
      source.onmessage = (m) => {
        const msg = JSON.parse(m.data) as BusMessage
        if (msg.kind === 'event') {
          setEvents((list) => upsert(list, msg.event, (e) => e.start))
          const e = msg.event
          const fresh = e.createdAt >= mountedAt.current - 5000
          if (e.status === 'described' && !e.repeatOf && fresh && !alerted.current.has(e.id)) {
            alerted.current.add(e.id)
            setAlert({ key: e.id, event: e })
          }
        } else if (msg.kind === 'delivery') {
          setDeliveries((list) => upsert(list, msg.delivery, (d) => d.at))
          const d = msg.delivery
          const key = `taken:${d.id}`
          if (d.status === 'taken' && !alerted.current.has(key)) {
            alerted.current.add(key)
            setAlert({ key, delivery: d })
          }
        } else if (msg.kind === 'lock') {
          setLock(msg.lock)
        }
      }
    }
    connect()
    return () => {
      clearTimeout(retry)
      source?.close()
    }
  }, [refresh])

  return (
    <Ctx.Provider
      value={{ profile, setProfile, prefs, setPrefs, events, deliveries, lock, connected, alert, refresh }}
    >
      {children}
    </Ctx.Provider>
  )
}
