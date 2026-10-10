'use client'

import { PATTERNS, alertKindFor } from '@/lib/alerts'
import type { DoorEvent } from '@/lib/types'

const SOURCE_LABEL: Record<DoorEvent['source'], string> = {
  history: 'Ring event',
  webhook: 'Ring webhook',
  live_frame: 'Live view',
  fixture: 'FIXTURE (not Ring)',
}

export function timeLabel(ms: number) {
  const d = new Date(ms)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function Thumb({ event, className = '' }: { event: DoorEvent; className?: string }) {
  const pattern = PATTERNS[alertKindFor(event.perception)]
  if (event.hasSnapshot) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/events/${encodeURIComponent(event.id)}/snapshot`}
        alt={event.perception ? `Snapshot: ${event.perception.caption}` : 'Doorbell snapshot'}
        className={`rounded-xl bg-ink-800 object-cover ${className}`}
        loading="lazy"
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className={`grid place-items-center rounded-xl text-3xl ${className}`}
      style={{ background: `${pattern.color}22` }}
    >
      {pattern.icon}
    </div>
  )
}

export function EventCard({ event, compact = false }: { event: DoorEvent; compact?: boolean }) {
  const p = event.perception
  const pattern = PATTERNS[alertKindFor(p)]
  return (
    <article className="flex gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-3" aria-label={p?.caption ?? 'Doorbell event'}>
      <Thumb event={event} className={compact ? 'h-16 w-24 shrink-0' : 'h-24 w-36 shrink-0'} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold" style={{ color: pattern.color }}>
            {pattern.icon} {p ? pattern.label : event.status === 'pending' ? 'Looking…' : 'Event'}
          </span>
          <time dateTime={new Date(event.start).toISOString()} className="text-slate-400">
            {timeLabel(event.start)}
          </time>
          <span className={`pill ${event.source === 'fixture' ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-ink-700 text-slate-300'}`}>
            {SOURCE_LABEL[event.source]}
          </span>
          {event.deliveryId && <span className="pill bg-amber-500/15 text-amber-200">Delivery log</span>}
        </div>
        {event.status === 'pending' && (
          <p className="mt-1 text-slate-300" aria-live="polite">
            Getting the snapshot from Ring and describing it…
          </p>
        )}
        {p && <p className={`mt-1 font-semibold text-white ${compact ? '' : 'text-lg'}`}>{p.caption}</p>}
        {p && !compact && <p className="mt-1 text-sm text-slate-300">{p.details}</p>}
        {(event.status === 'error' || event.status === 'no_media') && (
          <p className="mt-1 break-words text-sm text-amber-300">
            {event.status === 'no_media' ? 'Ring had no recording for this moment yet.' : 'Could not describe this event.'}{' '}
            <span className="line-clamp-2 break-all text-slate-400" title={event.error}>
              {event.error}
            </span>
          </p>
        )}
        {p && p.safetyNotes.length > 0 && !compact && (
          <p className="mt-1 text-xs text-sky-300" title="The safety pass edits AI output before anyone sees or hears it">
            🛡 {p.safetyNotes.join(' · ')}
          </p>
        )}
      </div>
    </article>
  )
}
