// Each alert kind has its own rhythm and colour, shared by screen, vibration and lights.

import type { Perception } from './perception/schema'
import type { DoorEvent } from './types'

export type AlertKind =
  | 'doorbell'
  | 'delivery'
  | 'visitor'
  | 'vehicle'
  | 'animal'
  | 'urgent'
  | 'package_taken'
  | 'passing'
  | 'parked'
  | 'quiet'

export interface AlertPattern {
  kind: AlertKind
  label: string
  /** On/off durations in ms, starting with "on". Used for flashes and vibration. */
  rhythm: number[]
  /** Colour for screen flash and smart bulbs. */
  color: string
  icon: string
}

export const PATTERNS: Record<AlertKind, AlertPattern> = {
  doorbell: {
    kind: 'doorbell',
    label: 'Doorbell rang',
    rhythm: [250, 120, 250, 120, 700],
    color: '#1075bc',
    icon: '🔔',
  },
  delivery: { kind: 'delivery', label: 'Delivery', rhythm: [600, 300, 600], color: '#f59e0b', icon: '📦' },
  visitor: {
    kind: 'visitor',
    label: 'Someone at the door',
    rhythm: [200, 150, 200, 150, 200],
    color: '#3b82f6',
    icon: '🚪',
  },
  vehicle: { kind: 'vehicle', label: 'Vehicle', rhythm: [900], color: '#a855f7', icon: '🚗' },
  animal: { kind: 'animal', label: 'Animal', rhythm: [150, 150, 150], color: '#22c55e', icon: '🐾' },
  urgent: {
    kind: 'urgent',
    label: 'Urgent',
    rhythm: [120, 80, 120, 80, 120, 80, 120, 80, 120],
    color: '#ef4444',
    icon: '⚠️',
  },
  package_taken: {
    kind: 'package_taken',
    label: 'Package picked up',
    rhythm: [400, 150, 400, 150, 400],
    color: '#ef4444',
    icon: '📤',
  },
  passing: { kind: 'passing', label: 'Passing by', rhythm: [], color: '#64748b', icon: '🚶' },
  parked: { kind: 'parked', label: 'Parked vehicle', rhythm: [], color: '#64748b', icon: '🅿️' },
  quiet: { kind: 'quiet', label: 'No activity', rhythm: [], color: '#64748b', icon: '·' },
}

export function alertKindFor(p: Perception | undefined): AlertKind {
  if (!p) return 'quiet'
  if (p.urgency === 'high') return 'urgent'
  if (p.package.action === 'picked_up') return 'package_taken'
  switch (p.category) {
    case 'delivery':
      return 'delivery'
    case 'visitor':
      return 'visitor'
    case 'vehicle':
      return 'vehicle'
    case 'animal':
      return 'animal'
    case 'no_activity':
      return 'quiet'
    default:
      return p.actors.length ? 'visitor' : 'quiet'
  }
}

type AlertableEvent = Pick<DoorEvent, 'ringType' | 'perception' | 'start' | 'expectationLabel' | 'cameraName'>

/** A doorbell press always alerts; someone only passing in the background never does. */
export function alertKindForEvent(e: Pick<DoorEvent, 'ringType' | 'perception'>): AlertKind {
  if (e.ringType === 'ding') return 'doorbell'
  const p = e.perception
  const kind = alertKindFor(p)
  if (!p || p.package.present) return kind
  const justPassing = p.motion === 'passing' || (kind === 'visitor' && p.atDoor === false)
  if ((kind === 'visitor' || kind === 'vehicle') && justPassing) return 'passing'
  // A vehicle only matters when it comes to or leaves the home; parked cars never alert.
  if (kind === 'vehicle' && p.motion !== 'arriving' && p.motion !== 'leaving') return 'parked'
  return kind
}

export function isSilent(kind: AlertKind): boolean {
  return PATTERNS[kind].rhythm.length === 0
}

/** Sentence for screen readers / speech, e.g. "Delivery. A courier leaving a box. Possibly your parcel. 2:14 PM." */
export function spokenText(e: AlertableEvent, timeZone?: string): string {
  const time = new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })
  const parts = [
    e.cameraName ? `${e.cameraName}: ${PATTERNS[alertKindForEvent(e)].label}` : PATTERNS[alertKindForEvent(e)].label,
  ]
  if (e.perception) parts.push(e.perception.caption)
  if (e.expectationLabel) parts.push(`Possibly ${e.expectationLabel}`)
  parts.push(time)
  return parts.join('. ') + '.'
}
