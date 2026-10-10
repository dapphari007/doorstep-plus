'use client'

import { useCallback, useEffect, useState } from 'react'

export interface AppStatus {
  fixtures: boolean
  ring: { connected: boolean; mode: string | null; runtimeToken: boolean; webhookVerification: boolean }
  aws: { credentials: boolean; region: string; perceptionModel: string; agentModel: string; store: string }
  poller: { running: boolean; lastPollAt?: number; lastSuccessAt?: number; lastError?: string; deviceId?: string; inFlight: number }
  lightWebhook: boolean
  timezone: string
}

export function useStatus(intervalMs = 5000) {
  const [status, setStatus] = useState<AppStatus>()
  const load = useCallback(async () => {
    try {
      setStatus(await fetch('/api/status').then((r) => r.json()))
    } catch {
      // server restarting
    }
  }, [])
  useEffect(() => {
    void load()
    const id = setInterval(load, intervalMs)
    return () => clearInterval(id)
  }, [load, intervalMs])
  return { status, reload: load }
}
