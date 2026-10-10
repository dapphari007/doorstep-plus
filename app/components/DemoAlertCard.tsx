'use client'

import { useMemo } from 'react'
import { alertKindForEvent, isSilent } from '@/lib/alerts'
import { useApp } from '../providers/AppProvider'
import { PROFILES } from '../utils/profiles'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Icon } from './ui/Icon'

/** In the public demo there's no live doorbell, so replay recorded Ring events as alerts. */
export function DemoAlertCard() {
  const { events, previewAlert, profile } = useApp()
  const samples = useMemo(
    () => events.filter((e) => e.status === 'described' && !e.repeatOf && !isSilent(alertKindForEvent(e))).slice(0, 20),
    [events],
  )

  const play = () => {
    if (!samples.length) return
    previewAlert(samples[Math.floor(Math.random() * samples.length)])
  }

  return (
    <Card className="p-5 sm:p-6" aria-labelledby="live-heading">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon name="bell" className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 id="live-heading" className="text-lg font-semibold">
            Try an alert
          </h2>
          <p className="mt-1 text-sm text-muted">
            Live view needs a personal Ring token, so it's off in this public demo. Replay a recorded Ring event to see
            how it's announced with the <strong>{PROFILES[profile].label}</strong> profile, then switch profiles at the
            top and try again.
          </p>
          <Button className="mt-4" icon="play" onClick={play} disabled={!samples.length}>
            Play a sample alert
          </Button>
          {!samples.length && <p className="mt-2 text-sm text-muted">No recorded events yet.</p>}
        </div>
      </div>
    </Card>
  )
}
