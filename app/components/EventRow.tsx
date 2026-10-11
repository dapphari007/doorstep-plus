import { isSilent } from '@/lib/alerts'
import type { DoorEvent } from '@/lib/types'
import { relativeTime } from '../utils/format'
import { kindOf, titleOf } from '../utils/kinds'
import { EventThumb } from './EventThumb'
import { Badge } from './ui/Badge'
import { Spinner } from './ui/Spinner'

export function EventRow({ event, now }: { event: DoorEvent; now: number }) {
  const kind = kindOf(event)
  return (
    <article className="flex items-center gap-3 py-3" aria-label={`${kind.label}: ${titleOf(event)}`}>
      <EventThumb event={event} className="h-14 w-20 shrink-0 rounded-xl sm:h-16 sm:w-24" />
      <div className="min-w-0 flex-1">
        <p className={`line-clamp-2 font-medium ${event.perception && !isSilent(kind.kind) ? '' : 'text-muted'}`}>
          {titleOf(event)}
        </p>
        <Filmstrip event={event} />
        {!!event.updates?.length && !event.summary && (
          <p className="line-clamp-1 text-sm text-muted">Then: {event.updates[event.updates.length - 1].caption}</p>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {event.status === 'pending' && <Spinner className="h-3 w-3" />}
          <span>{kind.label}</span>
          {event.cameraName && (
            <>
              <span aria-hidden="true">·</span>
              <span>{event.cameraName}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(event.start).toISOString()}>{relativeTime(event.start, now)}</time>
          {event.source === 'fixture' && <Badge tone="warning">Test data</Badge>}
          {event.deliveryId && <Badge tone="primary">Delivery</Badge>}
          {event.expectationLabel && <Badge tone="success">Possibly {event.expectationLabel}</Badge>}
        </div>
      </div>
    </article>
  )
}

/** The later photos of a merged scene, oldest first, next to the main thumbnail. */
function Filmstrip({ event }: { event: DoorEvent }) {
  const frames = (event.updates ?? []).filter((u) => u.eventId).slice(-3)
  if (!frames.length) return null
  return (
    <div className="mt-1.5 flex gap-1.5" aria-label={`${frames.length + 1} photos of this scene`}>
      {frames.map((u) => (
        <img
          key={u.eventId}
          src={`/api/events/${encodeURIComponent(u.eventId!)}/snapshot`}
          alt={u.view ? `${u.caption} (${u.view})` : u.caption}
          loading="lazy"
          className="h-9 w-14 rounded-md bg-subtle object-cover"
        />
      ))}
    </div>
  )
}
