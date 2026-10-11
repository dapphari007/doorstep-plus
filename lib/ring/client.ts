// Ring Partner API client. Server-side only (no CORS).

import { config } from '../config'
import { getAccessToken } from './auth'

export class RingApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'RingApiError'
  }

  /** Media can still show up shortly after an event. */
  get mediaMayAppear(): boolean {
    return this.status === 425 || this.status === 416 || this.status === 503
  }

  /** There is no usable recording behind this event (and retrying won't help). */
  get noMedia(): boolean {
    return this.mediaMayAppear || this.code === 'GRECO_NO_VALID_KEY' || this.code === 'CORRUPT_RECORDING'
  }
}

export interface RingDevice {
  id: string
  name: string
  online: boolean
  e2eEncrypted: boolean
  /** Camera modules on multi-camera devices (Ring Elite), in physical order; absent on single-camera devices. */
  components?: { id: string; name: string }[]
}

/** One view the app can watch: a device, or one camera module of a multi-camera device. */
export interface RingCamera {
  key: string
  deviceId: string
  componentId?: string
  name: string
  encrypted: boolean
}

export interface RingHistoryEvent {
  id: string
  eventType: string
  start: number
  end?: number
  deviceId: string
}

async function ringFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const url = path.startsWith('http') ? path : `${config.ring.apiBase}${path}`
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    cache: 'no-store',
  })
  // Media downloads answer 303 with a pre-signed Location; that is success.
  if (res.ok || (init.redirect === 'manual' && res.status >= 300 && res.status < 400)) return res

  let code: string | undefined
  let detail = res.statusText
  try {
    const body = await res.json()
    code = body?.errors?.[0]?.code
    detail = body?.errors?.[0]?.detail || JSON.stringify(body)
  } catch {
    // non-JSON error body
  }
  const retryAfter = Number(res.headers.get('Retry-After'))
  throw new RingApiError(
    res.status,
    code,
    `Ring ${init.method || 'GET'} ${path} failed: ${res.status} ${code ?? ''} ${detail}`.trim(),
    Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
  )
}

export async function listDevices(): Promise<RingDevice[]> {
  const res = await ringFetch('/v1/devices?include=status,capabilities,configurations')
  const body = await res.json()
  const included: any[] = body?.included || []
  return (body?.data || []).map((d: any) => {
    const status = included.find((i) => i.type === 'device-status' && i.id === d.relationships?.status?.data?.id)
    const conf = included.find(
      (i) => i.type === 'device-configurations' && i.id === d.relationships?.configurations?.data?.id,
    )
    const caps = included.find(
      (i) => i.type === 'device-capabilities' && i.id === d.relationships?.capabilities?.data?.id,
    )
    // component_id is opaque: read it, pass it back unchanged, never generate it.
    const components = (caps?.attributes?.components?.items ?? [])
      .filter((c: any) => c.component_type === 'lens' && c.component_id !== undefined)
      .map((c: any) => ({ id: String(c.component_id), name: c.component_name || String(c.component_id) }))
    return {
      id: d.id,
      name: d.attributes?.name || d.attributes?.description || 'Ring device',
      online: status?.attributes?.online ?? d.attributes?.online ?? false,
      e2eEncrypted: !!conf?.attributes?.e2e_encryption?.enabled,
      components: components.length ? components : undefined,
    }
  })
}

let cachedDeviceId: string | undefined
let cameraCache: { at: number; cameras: RingCamera[] } | undefined
const CAMERA_CACHE_MS = 5 * 60_000

export function cameraKey(deviceId: string, componentId?: string) {
  return componentId === undefined ? deviceId : `${deviceId}::${componentId}`
}

/** Every view on the account: one per device, or one per camera module on multi-camera devices. */
export function camerasFromDevices(devices: RingDevice[]): RingCamera[] {
  return devices.flatMap((d) =>
    d.components
      ? d.components.map((c) => ({
          key: cameraKey(d.id, c.id),
          deviceId: d.id,
          componentId: c.id,
          name: `${d.name} · ${c.name}`,
          encrypted: d.e2eEncrypted,
        }))
      : [{ key: d.id, deviceId: d.id, name: d.name, encrypted: d.e2eEncrypted }],
  )
}

/** Cameras on the account (or only RING_DEVICE_ID's), cached for a few minutes. */
export async function listCameras(): Promise<RingCamera[]> {
  if (cameraCache && Date.now() - cameraCache.at < CAMERA_CACHE_MS) return cameraCache.cameras
  const all = await listDevices()
  const devices = config.ring.deviceId ? all.filter((d) => d.id === config.ring.deviceId) : all
  cameraCache = { at: Date.now(), cameras: camerasFromDevices(devices) }
  return cameraCache.cameras
}

/** A camera's name from Ring, only worth showing when the home has more than one view. */
export function cameraLabel(cameras: RingCamera[], deviceId: string, componentId?: string): string | undefined {
  if (cameras.length < 2) return undefined
  const exact = cameras.find((c) => c.key === cameraKey(deviceId, componentId))
  return exact?.name ?? cameras.find((c) => c.deviceId === deviceId)?.name.split(' · ')[0]
}

export async function cameraNameOf(deviceId: string, componentId?: string): Promise<string | undefined> {
  try {
    return cameraLabel(await listCameras(), deviceId, componentId)
  } catch {
    return undefined
  }
}

/**
 * Multi-camera downloads must name a module; Ring doesn't say which one an event came from in history,
 * so default to the first in physical order.
 */
export async function defaultComponent(deviceId: string): Promise<string | undefined> {
  try {
    return (await listCameras()).find((c) => c.deviceId === deviceId)?.componentId
  } catch {
    return undefined
  }
}

/** The configured device, or the first device on the account (Playground has one DoorbellPro). */
export async function resolveDeviceId(): Promise<string> {
  if (config.ring.deviceId) return config.ring.deviceId
  if (cachedDeviceId) return cachedDeviceId
  const devices = await listDevices()
  if (!devices.length) throw new Error('No Ring devices are visible to this token.')
  cachedDeviceId = devices[0].id
  return cachedDeviceId
}

export async function getHistory(deviceId: string, eventTypes = 'on_demand,motion,ding'): Promise<RingHistoryEvent[]> {
  const res = await ringFetch(`/v1/history/devices/${encodeURIComponent(deviceId)}/events?event_types=${eventTypes}`)
  const body = await res.json()
  return (body?.data || []).map((e: any) => ({
    id: e.id,
    eventType: e.attributes?.event_type,
    start: Number(e.attributes?.start),
    end: e.attributes?.end ? Number(e.attributes.end) : undefined,
    deviceId: e.relationships?.source?.data?.id || deviceId,
  }))
}

export interface Snapshot {
  bytes: Buffer
  contentType: string
  mediaTimestamp?: number
}

// Media endpoints answer 303 with a pre-signed URL; follow it without our token.
export async function downloadSnapshot(
  deviceId: string,
  window: { start: number; end?: number },
  componentId?: string,
): Promise<Snapshot> {
  const range = window.end
    ? {
        type: 'latest_in_range',
        start_timestamp: window.start,
        end_timestamp: Math.min(window.end, Date.now()),
        image_options: { format: 'jpeg' },
      }
    : { type: 'at_timestamp', timestamp: window.start, image_options: { format: 'jpeg' } }
  const body = componentId === undefined ? range : { ...range, components: [{ component_id: componentId }] }

  const res = await ringFetch(`/v1/devices/${encodeURIComponent(deviceId)}/media/image/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'manual',
  })
  return followMediaRedirect(res)
}

/** Download a recorded clip (MP4). Does not trigger recording; footage must exist. */
export async function downloadClip(deviceId: string, timestamp: number, durationMs: number): Promise<Snapshot> {
  const res = await ringFetch(`/v1/devices/${encodeURIComponent(deviceId)}/media/video/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp,
      duration: Math.min(Math.max(durationMs, 1000), 900_000),
      video_options: { codec: 'avc' },
    }),
    redirect: 'manual',
  })
  return followMediaRedirect(res)
}

async function followMediaRedirect(res: Response): Promise<Snapshot> {
  let media = res
  const location = res.headers.get('Location')
  if (res.status >= 300 && res.status < 400 && location) {
    media = await fetch(location, { cache: 'no-store' })
    if (!media.ok) {
      let code: string | undefined
      let detail = media.statusText
      try {
        const err = await media.json()
        code = err?.errors?.[0]?.code
        detail = err?.errors?.[0]?.detail || detail
      } catch {
        // binary or empty body
      }
      throw new RingApiError(media.status, code, `Ring media download failed: ${media.status} ${code ?? ''} ${detail}`)
    }
  }
  const ts = Number(media.headers.get('X-Media-Timestamp'))
  return {
    bytes: Buffer.from(await media.arrayBuffer()),
    contentType: media.headers.get('Content-Type') || 'application/octet-stream',
    mediaTimestamp: Number.isFinite(ts) && ts > 0 ? ts : undefined,
  }
}

export async function startWhepSession(deviceId: string, sdpOffer: string, componentId?: string) {
  const query = componentId === undefined ? '' : `?component_id=${encodeURIComponent(componentId)}`
  const res = await ringFetch(`/v1/devices/${encodeURIComponent(deviceId)}/media/streaming/whep/sessions${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: sdpOffer,
  })
  return { sdpAnswer: await res.text(), sessionUrl: res.headers.get('Location') }
}

export async function stopWhepSession(sessionUrl: string) {
  // Only ever talk to Ring's own API host with our token.
  const url = new URL(sessionUrl, config.ring.apiBase)
  if (url.origin !== new URL(config.ring.apiBase).origin) {
    throw new Error('Refusing to send Ring token to a non-Ring host')
  }
  await ringFetch(url.toString(), { method: 'DELETE' })
}
