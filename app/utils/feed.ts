import { alertKindForEvent, isSilent } from '@/lib/alerts'
import type { DoorEvent } from '@/lib/types'
import { dayLabel } from './format'

/** Repeats, quiet live-view frames and live-view sessions without media aren't activity. */
export function isVisible(e: DoorEvent): boolean {
  if (e.repeatOf) return false
  if (e.source === 'live_frame' && e.perception?.category === 'no_activity') return false
  if (e.ringType === 'on_demand' && (e.status === 'no_media' || e.status === 'error')) return false
  return true
}

export function visibleEvents(events: DoorEvent[]): DoorEvent[] {
  return events.filter(isVisible)
}

export function groupByDay(events: DoorEvent[], now = Date.now()): { day: string; events: DoorEvent[] }[] {
  const groups: { day: string; events: DoorEvent[] }[] = []
  for (const e of events) {
    const day = dayLabel(e.start, now)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.events.push(e)
    else groups.push({ day, events: [e] })
  }
  return groups
}

/** Should a freshly streamed event pop an alert? Doorbell presses alert even without a picture. */
export function shouldAlert(e: DoorEvent, since: number, alreadyAlerted: Set<string>): boolean {
  const ready = e.status === 'described' || (e.ringType === 'ding' && e.status !== 'pending')
  return ready && !e.repeatOf && !isSilent(alertKindForEvent(e)) && e.createdAt >= since && !alreadyAlerted.has(e.id)
}

export type FeedFilter = 'all' | 'deliveries' | 'people' | 'vehicles' | 'doorbell' | 'expected'

export const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'people', label: 'People' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'doorbell', label: 'Doorbell' },
  { id: 'expected', label: 'Expected' },
]

export function matchesFilter(e: DoorEvent, filter: FeedFilter): boolean {
  const p = e.perception
  switch (filter) {
    case 'deliveries':
      return !!e.deliveryId || !!p?.package.present
    case 'people':
      return !!p && (p.category === 'visitor' || p.actors.some((a) => a.role !== 'unclear'))
    case 'vehicles':
      return !!p && (p.category === 'vehicle' || p.vehicle.present)
    case 'doorbell':
      return e.ringType === 'ding'
    case 'expected':
      return !!e.expectationId
    default:
      return true
  }
}
