// The Playground has no motion webhooks, so poll Event History for new events.

import { config, hasRingAuth } from '../config'
import { MAX_ATTEMPTS, processRingEvent } from '../pipeline'
import { getStore } from '../store'
import { hasRuntimeAccessToken } from './auth'
import { RingApiError, getHistory, resolveDeviceId } from './client'

export interface PollerStatus {
  running: boolean
  lastPollAt?: number
  lastSuccessAt?: number
  lastError?: string
  deviceId?: string
  inFlight: number
}

interface PollerState {
  timer?: ReturnType<typeof setTimeout>
  status: PollerStatus
  firstRunDone: boolean
  skipped: Set<string>
  inFlight: Set<string>
}

const g = globalThis as unknown as { __doorstepPoller?: PollerState }
const state: PollerState = (g.__doorstepPoller ??= {
  status: { running: false, inFlight: 0 },
  firstRunDone: false,
  skipped: new Set(),
  inFlight: new Set(),
})

const MAX_CONCURRENT = 2

export function pollerStatus(): PollerStatus {
  return { ...state.status, inFlight: state.inFlight.size }
}

export async function pollOnce(): Promise<number> {
  state.status.lastPollAt = Date.now()
  if (!hasRingAuth() && !hasRuntimeAccessToken()) {
    state.status.lastError = 'Ring is not connected yet'
    return 0
  }
  try {
    const deviceId = await resolveDeviceId()
    state.status.deviceId = deviceId
    const history = await getHistory(deviceId)
    const store = getStore()

    const fresh = []
    for (const h of history) {
      if (state.skipped.has(h.id) || state.inFlight.has(h.id)) continue
      const known = await store.getEvent(h.id)
      if (known && (known.status !== 'error' || (known.attempts ?? 1) >= MAX_ATTEMPTS)) continue
      fresh.push(h)
    }

    // On first boot, describe only the newest few; older history is not news.
    let queue = fresh
    if (!state.firstRunDone) {
      queue = fresh.slice(0, config.poller.backfill)
      fresh.slice(config.poller.backfill).forEach((h) => state.skipped.add(h.id))
      state.firstRunDone = true
    }

    // Oldest first, so alerts arrive in the order things happened.
    for (const h of queue.reverse()) {
      if (state.inFlight.size >= MAX_CONCURRENT) break
      state.inFlight.add(h.id)
      processRingEvent({
        id: h.id,
        deviceId: h.deviceId,
        ringType: h.eventType,
        start: h.start,
        end: h.end,
        source: 'history',
      })
        .catch((err) => console.warn('[poller] process failed:', err))
        .finally(() => state.inFlight.delete(h.id))
    }

    state.status.lastSuccessAt = Date.now()
    state.status.lastError = undefined
    return queue.length
  } catch (err) {
    state.status.lastError =
      err instanceof RingApiError && err.status === 401
        ? 'Ring token expired or invalid. Generate a new one in the Ring Developer Playground and paste it on the Settings page.'
        : err instanceof Error
          ? err.message
          : String(err)
    return 0
  }
}

export function startPoller() {
  if (state.status.running || !config.poller.enabled || config.fixtures) return
  state.status.running = true
  const tick = async () => {
    await pollOnce()
    state.timer = setTimeout(tick, config.poller.intervalMs)
  }
  void tick()
  console.log(`[poller] polling Ring event history every ${config.poller.intervalMs} ms`)
}
