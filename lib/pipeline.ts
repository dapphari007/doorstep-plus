// Ring event -> snapshot -> description -> store -> alerts, deliveries, lights.

import { randomUUID } from 'crypto'
import { publish } from './bus'
import { config } from './config'
import { handleDeliveryLogic } from './delivery/flow'
import { applyExpectations } from './expectations/service'
import { notifyLight } from './notify/light'
import { describeFrame } from './perception/describe'
import { RingApiError, cameraNameOf, defaultComponent, downloadSnapshot, privacyZonesOf } from './ring/client'
import { maskPrivacyZones } from './perception/privacy'
import { closeOpenScenes, touchScene } from './scenes/summary'
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
  // "A bird" and "two birds" are the same scene.
  const roles = Array.from(new Set(p.actors.map((a) => a.role)))
    .sort()
    .join(',')
  return [p.category, p.package.present, p.package.action, p.vehicle.present, roles, p.motion ?? 'none'].join('|')
}

/** A vehicle moving through the view is one scene, even as its motion changes frame to frame. */
export function sameScene(a: Perception, b: Perception): boolean {
  if (sceneSignature(a) === sceneSignature(b)) return true
  const vehicleOnly = (p: Perception) =>
    p.category === 'vehicle' && p.vehicle.present && !p.actors.length && !p.package.present
  return vehicleOnly(a) && vehicleOnly(b)
}

/** Failed events are retried on later polls, but not forever. */
export const MAX_ATTEMPTS = 3

export interface IncomingRingEvent {
  id: string
  deviceId: string
  ringType: string
  subType?: string
  componentId?: string
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
      return await downloadSnapshot(e.deviceId, window, e.componentId ?? (await defaultComponent(e.deviceId)))
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

/** Live view sessions show up in Ring's history as on_demand events. */
const SESSION_SLACK_MS = 5000
const SESSION_MAX_MS = 5 * 60_000

/** The latest frame we described live during this Ring session, if any. */
export async function liveSessionFrame(e: IncomingRingEvent): Promise<DoorEvent | undefined> {
  if (e.ringType !== 'on_demand' || e.source === 'live_frame') return undefined
  const until = (e.end && e.end > e.start ? e.end : e.start + SESSION_MAX_MS) + SESSION_SLACK_MS
  const frames = await getStore().listEvents({ since: e.start - SESSION_SLACK_MS, until, limit: 50 })
  return frames.find((f) => f.source === 'live_frame' && f.status === 'described' && f.perception)
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
    cameraName: await cameraNameOf(incoming.deviceId, incoming.componentId),
  }
  const live = await liveSessionFrame(incoming)
  if (live) {
    // Our own live view already described this session; keep one row and one alert.
    event.status = 'described'
    event.perception = live.perception
    event.repeatOf = live.repeatOf ?? live.id
    return finish(event)
  }
  await save(event)

  try {
    let image: Buffer | undefined
    let mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg'
    if (!config.fixtures) {
      const snap = await fetchSnapshot(incoming)
      const component = incoming.componentId ?? (await defaultComponent(incoming.deviceId))
      image = await maskPrivacyZones(snap.bytes, await privacyZonesOf(incoming.deviceId, component))
      mediaType = snap.contentType.includes('png') ? 'image/png' : 'image/jpeg'
      await store.putSnapshot(event.id, image, snap.contentType)
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
  componentId?: string
  /** The latest frame. */
  image: Buffer
  /** Earlier frames from the same moment, oldest first. */
  earlier?: Buffer[]
  mediaType: 'image/jpeg' | 'image/png'
  hint?: string
}): Promise<DoorEvent> {
  const now = Date.now()
  // Privacy zones are blacked out before the frames are stored or described.
  const zones = config.fixtures ? [] : await privacyZonesOf(args.deviceId, args.componentId)
  const image = await maskPrivacyZones(args.image, zones)
  const earlier = await Promise.all((args.earlier ?? []).map((f) => maskPrivacyZones(f, zones)))
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
    componentId: args.componentId,
    cameraName: config.fixtures ? undefined : await cameraNameOf(args.deviceId, args.componentId),
  }
  if (event.hasSnapshot) await getStore().putSnapshot(event.id, image, args.mediaType)
  await save(event)
  try {
    event.perception = await describeFrame({
      image,
      earlier,
      mediaType: args.mediaType,
      ringHint: 'live view',
      fixtureScene: args.hint,
    })
    event.status = 'described'
    const recent = await getStore().listEvents({ since: now - REPEAT_WINDOW_MS, limit: 20 })
    // Any scene from the last minute and a half counts, so one odd frame can't trigger a second alert.
    const previous = recent.find(
      (e) =>
        e.id !== event.id &&
        e.source === event.source &&
        e.status === 'described' &&
        !e.repeatOf &&
        !e.summary &&
        !!e.perception &&
        sameScene(e.perception, event.perception!),
    )
    if (previous) {
      event.repeatOf = previous.repeatOf ?? previous.id
      await mergeIntoOriginal(event)
      touchScene(event.repeatOf)
    }
  } catch (err) {
    event.status = 'error'
    event.error = err instanceof Error ? err.message : String(err)
  }
  const done = await finish(event)
  if (done.status === 'described' && !done.repeatOf) {
    // A moment of empty view (a camera cut, the car between two views) doesn't end the story;
    // only a different scene does, or the quiet timer.
    if (done.perception?.category !== 'no_activity')
      void closeOpenScenes(done.id).catch((err) => console.warn('[pipeline] closing scenes failed:', err))
    touchScene(done.id)
  }
  return done
}

const MAX_UPDATES = 5

/** Adds a repeat's caption and photo to the event that alerted, so the row tells the whole story. */
async function mergeIntoOriginal(repeat: DoorEvent) {
  const store = getStore()
  const original = repeat.repeatOf && (await store.getEvent(repeat.repeatOf))
  const caption = repeat.perception?.caption
  if (!original || !caption) return
  const view = repeat.perception?.view
  const frames = [
    { caption: original.perception?.caption, view: original.perception?.view },
    ...(original.updates ?? []),
  ]
  const latest = frames[frames.length - 1]
  // Same words in the same place is not news; the same words from a new camera view is.
  if (latest.caption?.toLowerCase() === caption.toLowerCase() && latest.view === view) return
  const update = { at: repeat.start, caption, view, eventId: repeat.hasSnapshot ? repeat.id : undefined }
  original.updates = [...(original.updates ?? []), update].slice(-MAX_UPDATES)
  await save(original)
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
