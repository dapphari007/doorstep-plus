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
  /** The expected visitor or parcel this event probably is. */
  expectationId?: string
  expectationLabel?: string
  createdAt: number
}

/** Someone or something the household is expecting, matched by time and what is seen, never by face. */
export interface Expectation {
  id: string
  kind: 'visitor' | 'parcel' | 'household'
  label: string
  from: number
  until: number
  status: 'waiting' | 'arrived' | 'cancelled'
  matchedEventId?: string
  matchedAt?: number
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
  /** Set when this package matched a parcel the household was expecting. */
  expectedLabel?: string
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
  | { kind: 'expectation'; expectation: Expectation }
  | { kind: 'status'; status: Record<string, unknown> }
