import type { DoorEvent } from '@/lib/types'
import { relativeTime } from '../utils/format'
import { kindOf } from '../utils/kinds'
import { EventThumb } from './EventThumb'
import { Icon } from './ui/Icon'

/** Home hero: the latest snapshot edge to edge, with the headline underneath. */
export function NowHero({ event, now }: { event?: DoorEvent; now: number }) {
  if (!event?.perception) {
    return (
      <section aria-labelledby="now-heading" className="border-b border-line bg-subtle">
        <div className="px-4 py-12 sm:px-8 md:py-16 lg:px-16">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <Icon name="check" className="h-4 w-4" /> Right now
          </p>
          <h1 id="now-heading" className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            All quiet at your door.
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">You'll be alerted the moment something happens.</p>
        </div>
      </section>
    )
  }

  const kind = kindOf(event)
  return (
    <section aria-labelledby="now-heading" className="border-b border-line">
      {event.hasSnapshot && (
        <div className="bg-black">
          <EventThumb
            event={event}
            className="mx-auto h-[38vh] max-h-[560px] min-h-[220px] w-full max-w-[1400px] !bg-black !object-contain"
          />
        </div>
      )}
      <div className="px-4 py-8 sm:px-8 md:py-10 lg:px-16">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
          <Icon name={kind.icon} className="h-4 w-4" />
          {kind.label}
          <span className="font-normal text-muted">· {relativeTime(event.start, now)}</span>
        </p>
        <h1 id="now-heading" className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
          {event.perception.caption}
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-muted">{event.perception.details}</p>
        {event.perception.safetyNotes.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-muted">
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Safety check: {event.perception.safetyNotes.join(' · ')}</span>
          </p>
        )}
      </div>
    </section>
  )
}
