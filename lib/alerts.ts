// Each alert kind has its own rhythm and colour, shared by screen, vibration and lights.

import type { Perception } from './perception/schema'

export type AlertKind = 'delivery' | 'visitor' | 'vehicle' | 'animal' | 'urgent' | 'package_taken' | 'quiet'

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
  delivery: { kind: 'delivery', label: 'Delivery', rhythm: [600, 300, 600], color: '#f59e0b', icon: '📦' },
  visitor: { kind: 'visitor', label: 'Someone at the door', rhythm: [200, 150, 200, 150, 200], color: '#3b82f6', icon: '🚪' },
  vehicle: { kind: 'vehicle', label: 'Vehicle', rhythm: [900], color: '#a855f7', icon: '🚗' },
  animal: { kind: 'animal', label: 'Animal', rhythm: [150, 150, 150], color: '#22c55e', icon: '🐾' },
  urgent: { kind: 'urgent', label: 'Urgent', rhythm: [120, 80, 120, 80, 120, 80, 120, 80, 120], color: '#ef4444', icon: '⚠️' },
  package_taken: { kind: 'package_taken', label: 'Package picked up', rhythm: [400, 150, 400, 150, 400], color: '#ef4444', icon: '📤' },
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

/** Sentence for screen readers / speech, e.g. "Delivery. Delivery driver leaving a box. 2:14 PM." */
export function spokenText(p: Perception, at: number, timeZone?: string): string {
  const time = new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })
  const kind = PATTERNS[alertKindFor(p)].label
  return `${kind}. ${p.caption}. ${time}.`
}
