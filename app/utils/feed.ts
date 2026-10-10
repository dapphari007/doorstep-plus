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

export function latestDescribed(events: DoorEvent[]): DoorEvent | undefined {
  return events.find((e) => e.status === 'described' && !e.repeatOf && e.perception?.category !== 'no_activity')
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

/** Should a freshly streamed event pop an alert? */
export function shouldAlert(e: DoorEvent, since: number, alreadyAlerted: Set<string>): boolean {
  return (
    e.status === 'described' &&
    !e.repeatOf &&
    e.perception?.category !== 'no_activity' &&
    e.createdAt >= since &&
    !alreadyAlerted.has(e.id)
  )
}
