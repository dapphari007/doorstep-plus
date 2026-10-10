'use client'

import { useState } from 'react'
import type { DoorEvent } from '@/lib/types'
import { kindOf } from '../utils/kinds'
import { Icon } from './ui/Icon'

export function EventThumb({ event, className = '' }: { event: DoorEvent; className?: string }) {
  const [failed, setFailed] = useState(false)
  const kind = kindOf(event)

  if (event.hasSnapshot && !failed) {
    return (
      <img
        src={`/api/events/${encodeURIComponent(event.id)}/snapshot`}
        alt={event.perception ? `Snapshot: ${event.perception.caption}` : 'Doorbell snapshot'}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`bg-subtle object-cover ${className}`}
      />
    )
  }
  return (
    <div aria-hidden="true" className={`grid place-items-center bg-subtle text-muted ${className}`}>
      <Icon name={kind.icon} className="h-6 w-6" />
    </div>
  )
}
