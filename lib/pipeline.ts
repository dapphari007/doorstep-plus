// Ring event -> snapshot -> description -> store -> alerts, deliveries, lights.

import { randomUUID } from 'crypto'
import { publish } from './bus'
import { config } from './config'
import { handleDeliveryLogic } from './delivery/flow'
import { applyExpectations } from './expectations/service'
import { notifyLight } from './notify/light'
import { describeFrame } from './perception/describe'
import { RingApiError, downloadSnapshot } from './ring/client'
import { getStore } from './store'
import type { Perception } from './perception/schema'
import type { DoorEvent, EventSource } from './types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// Ring can answer 425/416 for ~2 minutes after an event while the recording lands.
const MEDIA_RETRY_DELAYS_MS = [2000, 4000, 8000, 12000, 20000, 30000, 45000]

/** Live frames showing the same scene within this window don't alert again. */
export const REPEAT_WINDOW_MS = 90_000

/** What has to change for a frame to count as news. */
export function sceneSignature(p: Perception): string {
  const roles = p.actors
    .map((a) => a.role)
    .sort()
    .join(',')
  return [p.category, p.package.present, p.package.action, p.vehicle.present, roles, p.motion ?? 'none'].join('|')
}

/** Failed events are retried on later polls, but not forever. */
export const MAX_ATTEMPTS = 3

export interface IncomingRingEvent {
  id: string
  deviceId: string
  ringType: string
  subType?: string
  start: number
  end?: number
  source: EventSource
}

async function save(event: DoorEvent) {
  await getStore().putEvent(event)
  publish({ kind: 'event', event })
}

async function fetchSnapshot(e: IncomingRingEvent) {
  const window = e.end && e.end > e.start ? { start: e.start, end: e.end } : { start: e.start + 1500 }
  for (let attempt = 0; ; attempt++) {
    try {
      return await downloadSnapshot(e.deviceId, window)
    } catch (err) {
      const retryable = err instanceof RingApiError && (err.mediaMayAppear || err.status === 429)
      if (!retryable || attempt >= MEDIA_RETRY_DELAYS_MS.length) throw err
      const wait = (err as RingApiError).retryAfterMs ?? MEDIA_RETRY_DELAYS_MS[attempt]
      console.log(
        `[pipeline] snapshot not ready (${(err as RingApiError).status} ${(err as RingApiError).code ?? ''}), retry ${attempt + 1} in ${wait / 1000}s`,
      )
      await sleep(wait)
    }
  }
}

/** Describe an event from Ring (history poll or webhook). Safe to call twice for one id. */
export async function processRingEvent(incoming: IncomingRingEvent): Promise<DoorEvent> {
  const store = getStore()
  const existing = await store.getEvent(incoming.id)
  if (existing && (existing.status !== 'error' || (existing.attempts ?? 1) >= MAX_ATTEMPTS)) return existing

  const event: DoorEvent = {
    ...incoming,
    status: 'pending',
    hasSnapshot: false,
    attempts: (existing?.attempts ?? 0) + 1,
    createdAt: existing?.createdAt ?? Date.now(),
  }
  await save(event)

  try {
    let image: Buffer | undefined
    let mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg'
    if (!config.fixtures) {
      const snap = await fetchSnapshot(incoming)
      image = snap.bytes
      mediaType = snap.contentType.includes('png') ? 'image/png' : 'image/jpeg'
      await store.putSnapshot(event.id, snap.bytes, snap.contentType)
      event.hasSnapshot = true
    }
    event.perception = await describeFrame({
      image: image ?? Buffer.alloc(0),
      mediaType,
      ringHint: [incoming.ringType, incoming.subType].filter(Boolean).join(' / '),
      fixtureScene: incoming.subType,
    })
    event.status = 'described'
  } catch (err) {
    const noMedia = err instanceof RingApiError && err.noMedia
    event.status = noMedia ? 'no_media' : 'error'
    event.error = err instanceof Error ? err.message : String(err)
    console.warn(`[pipeline] ${event.id}: ${event.error}`)
  }

  return finish(event)
}

/** Describe a frame grabbed from the live WHEP stream in the browser. */
export async function processLiveFrame(args: {
  deviceId: string
  /** The latest frame. */
  image: Buffer
  /** Earlier frames from the same moment, oldest first. */
  earlier?: Buffer[]
  mediaType: 'image/jpeg' | 'image/png'
  hint?: string
}): Promise<DoorEvent> {
  const now = Date.now()
  const event: DoorEvent = {
    id: `live_${now}_${randomUUID().slice(0, 8)}`,
    deviceId: args.deviceId,
    ringType: 'on_demand',
    subType: args.hint,
    start: now,
    source: config.fixtures ? 'fixture' : 'live_frame',
    status: 'pending',
    hasSnapshot: args.image.length > 0,
    createdAt: now,
  }
  if (event.hasSnapshot) await getStore().putSnapshot(event.id, args.image, args.mediaType)
  await save(event)
  try {
    event.perception = await describeFrame({
      image: args.image,
      earlier: args.earlier,
      mediaType: args.mediaType,
      ringHint: 'live view',
      fixtureScene: args.hint,
    })
    event.status = 'described'
    const recent = await getStore().listEvents({ since: now - REPEAT_WINDOW_MS, limit: 20 })
    const previous = recent.find((e) => e.id !== event.id && e.source === event.source && e.status === 'described')
    if (previous?.perception && sceneSignature(previous.perception) === sceneSignature(event.perception)) {
      event.repeatOf = previous.repeatOf ?? previous.id
    }
  } catch (err) {
    event.status = 'error'
    event.error = err instanceof Error ? err.message : String(err)
  }
  return finish(event)
}

async function finish(event: DoorEvent): Promise<DoorEvent> {
  const newScene = event.status === 'described' && !event.repeatOf
  // A doorbell press matters even if Ring had no picture for it.
  if (newScene || event.ringType === 'ding') {
    try {
      await applyExpectations(event)
    } catch (err) {
      console.warn('[pipeline] expectation matching failed:', err)
    }
  }
  if (newScene) {
    try {
      const delivery = await handleDeliveryLogic(event)
      if (delivery) event.deliveryId = delivery.id
    } catch (err) {
      console.warn('[pipeline] delivery flow failed:', err)
    }
    void notifyLight(event)
  }
  await save(event)
  return event
}
