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
        {!!event.updates?.length && (
          <p className="line-clamp-1 text-sm text-muted">Then: {event.updates[event.updates.length - 1].caption}</p>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {event.status === 'pending' && <Spinner className="h-3 w-3" />}
          <span>{kind.label}</span>
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
