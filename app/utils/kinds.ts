import { PATTERNS, alertKindForEvent, type AlertKind } from '@/lib/alerts'
import type { DoorEvent } from '@/lib/types'
import type { IconName } from '../components/ui/Icon'

const ICONS: Record<AlertKind, IconName> = {
  doorbell: 'bell',
  delivery: 'box',
  visitor: 'person',
  vehicle: 'car',
  animal: 'paw',
  urgent: 'alert',
  package_taken: 'box',
  passing: 'person',
  quiet: 'door',
}

export function iconFor(kind: AlertKind): IconName {
  return ICONS[kind]
}

export interface EventKind {
  kind: AlertKind
  label: string
  icon: IconName
  color: string
}

export function kindOf(event: DoorEvent): EventKind {
  const kind = alertKindForEvent(event)
  const label = event.perception || kind === 'doorbell' ? PATTERNS[kind].label : 'Event'
  return { kind, label, icon: ICONS[kind], color: PATTERNS[kind].color }
}

export function titleOf(event: DoorEvent): string {
  if (event.perception) return event.perception.caption
  if (event.ringType === 'ding') return 'Someone rang the doorbell'
  if (event.status === 'pending') return 'Looking at what happened…'
  if (event.status === 'no_media') return 'No video was saved for this moment'
  return 'Could not describe this event'
}
