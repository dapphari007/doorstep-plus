'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../utils/format'

export interface AppStatus {
  fixtures: boolean
  demo?: boolean
  ring: { connected: boolean; mode: string | null; runtimeToken: boolean; webhookVerification: boolean }
  aws: { credentials: boolean; region: string; perceptionModel: string; agentModel: string; store: 'local' | 'aws' }
  poller: {
    running: boolean
    lastPollAt?: number
    lastSuccessAt?: number
    lastError?: string
    deviceId?: string
    inFlight: number
  }
  lightWebhook: boolean
  timezone: string
}

/** Polls /api/status, pausing while the tab is hidden. */
export function useStatus(intervalMs = 5000) {
  const [status, setStatus] = useState<AppStatus>()
  const [offline, setOffline] = useState(false)

  const reload = useCallback(async () => {
    try {
      setStatus(await fetchJson<AppStatus>('/api/status'))
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }, [])

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined
    const schedule = () => {
      clearInterval(id)
      if (document.visibilityState === 'visible') {
        void reload()
        id = setInterval(reload, intervalMs)
      }
    }
    schedule()
    document.addEventListener('visibilitychange', schedule)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [reload, intervalMs])

  return { status, offline, reload }
}
