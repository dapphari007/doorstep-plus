// Pure rules for expected visitors and parcels: time windows and what counts as a match.

import { alertKindForEvent } from '../alerts'
import type { Perception } from '../perception/schema'
import type { DoorEvent, Expectation } from '../types'

/** Arrivals this long before or after the window still count. */
export const GRACE_MS = 30 * 60_000
export const MAX_WINDOW_MS = 3 * 24 * 3600_000
export const HOUSEHOLD_WINDOW_MS = 30 * 60_000

export type EffectiveStatus = Expectation['status'] | 'missed'

export function effectiveStatus(x: Expectation, now = Date.now()): EffectiveStatus {
  if (x.status === 'waiting' && now > x.until + GRACE_MS) return 'missed'
  return x.status
}

function hasPerson(p: Perception) {
  return p.actors.some((a) => a.role !== 'unclear') || p.category === 'visitor'
}

/** Does this event fit this expectation's kind? Never looks at who someone is. */
export function fits(event: DoorEvent, x: Expectation): boolean {
  const p = event.perception
  if (x.kind === 'parcel') return !!p?.package.present
  if (event.ringType === 'ding') return true
  return !!p && hasPerson(p)
}

/** The waiting expectation this event most likely is, if any. */
export function matchExpectation(event: DoorEvent, expectations: Expectation[]): Expectation | undefined {
  if (event.repeatOf) return undefined
  if (event.ringType !== 'ding' && event.status !== 'described') return undefined
  if (alertKindForEvent(event) === 'passing') return undefined

  const t = event.start
  const centre = (x: Expectation) => (x.from + x.until) / 2
  return expectations
    .filter((x) => x.status === 'waiting' && t >= x.from - GRACE_MS && t <= x.until + GRACE_MS && fits(event, x))
    .sort((a, b) => affinity(event, a) - affinity(event, b) || Math.abs(centre(a) - t) - Math.abs(centre(b) - t))[0]
}

/** Lower is a better fit: a visible package means a parcel, a courier is a weak match for a visitor. */
function affinity(event: DoorEvent, x: Expectation): number {
  const p = event.perception
  if (x.kind === 'parcel') return p?.package.present ? 0 : 2
  const onlyCouriers = !!p?.actors.length && p.actors.every((a) => a.role === 'delivery_person')
  return onlyCouriers ? 1 : 0
}

// Role words read naturally in lower case ("your plumber"); names and brands keep their capitals.
const COMMON_WORDS = new Set(
  'plumber electrician guest guests friend friends cleaner maid cook nanny carpenter painter technician mechanic gardener courier driver delivery visitor parcel package groceries food tutor doctor nurse'.split(
    ' ',
  ),
)

/** How the match is said in alerts: "your plumber", "your Amazon parcel", "Asha arriving home". */
export function expectationPhrase(x: Pick<Expectation, 'kind' | 'label'>): string {
  const label = x.label.trim()
  if (x.kind === 'household') return `${label} arriving home`
  const [first, ...rest] = label.split(' ')
  const common = COMMON_WORDS.has(first.toLowerCase()) ? first.toLowerCase() : first
  return `your ${[common, ...rest].join(' ')}`
}

function zoneOffsetMs(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(at))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(at / 1000) * 1000
}

/** Epoch ms for a local "HH:MM" today (+dayOffset days) in the home's time zone. */
export function localTimeToEpoch(hhmm: string, dayOffset: number, timeZone: string, now = Date.now()): number {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim())
  if (!m) throw new Error(`Time must look like 15:00, got "${hhmm}"`)
  const local = new Date(now + zoneOffsetMs(timeZone, now))
  const wall = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + dayOffset,
    Number(m[1]),
    Number(m[2]),
  )
  // Re-check the offset at the target time so daylight-saving changes land correctly.
  return wall - zoneOffsetMs(timeZone, wall - zoneOffsetMs(timeZone, now))
}

export function validateWindow(from: number, until: number): string | undefined {
  if (!Number.isFinite(from) || !Number.isFinite(until)) return 'Start and end times are required'
  if (until <= from) return 'The end time must be after the start time'
  if (until - from > MAX_WINDOW_MS) return 'Windows can be at most 3 days long'
  if (until < Date.now() - GRACE_MS) return 'That time window is already over'
  return undefined
}
