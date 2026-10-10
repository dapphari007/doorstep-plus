import type { Perception } from './perception/schema'

export type EventSource = 'history' | 'webhook' | 'live_frame' | 'fixture'

/** A Ring event after Doorstep+ has looked at it. */
export interface DoorEvent {
  /** Ring's event id, or a generated id for live-frame captures. */
  id: string
  deviceId: string
  /** Ring event type: on_demand, motion, ding (open vocabulary). */
  ringType: string
  /** Ring motion sub_type when known: human, vehicle, package_delivery, ... */
  subType?: string
  /** Epoch ms. */
  start: number
  end?: number
  source: EventSource
  status: 'pending' | 'described' | 'no_media' | 'error'
  error?: string
  /** How many times the pipeline has tried this event. */
  attempts?: number
  /** True when a snapshot image is stored for this event. */
  hasSnapshot: boolean
  perception?: Perception
  deliveryId?: string
  /** Set when a live frame shows the same scene as a recent one: stored, but no new alert. */
  repeatOf?: string
  createdAt: number
}

export interface DeliveryRecord {
  id: string
  eventId: string
  at: number
  status: 'verified' | 'needs_review' | 'taken'
  carrierGuess?: string
  summary: string
  /** One-time code issued to the simulated parcel lock, if verified. */
  code?: string
  codeExpiresAt?: number
  /** Event that showed the package being picked up, if any. */
  takenEventId?: string
  takenAt?: number
}

export interface LockState {
  simulated: true
  locked: boolean
  unlockedUntil?: number
  activeCode?: { code: string; expiresAt: number; deliveryId: string }
  log: { at: number; action: string; detail: string }[]
}

export type BusMessage =
  | { kind: 'event'; event: DoorEvent }
  | { kind: 'delivery'; delivery: DeliveryRecord }
  | { kind: 'lock'; lock: LockState }
  | { kind: 'status'; status: Record<string, unknown> }
