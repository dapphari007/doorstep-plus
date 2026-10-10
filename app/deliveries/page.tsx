'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import type { DeliveryRecord, LockState } from '@/lib/types'
import { EventThumb } from '../components/EventThumb'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, Container, PageHeader, SectionTitle } from '../components/ui/Card'
import { EmptyState, InlineMessage } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { useNow } from '../hooks/useNow'
import { useApp } from '../providers/AppProvider'
import { GRACE_MS, effectiveStatus } from '@/lib/expectations/match'
import { clockTime, errorMessage, postJson, relativeTime, secondsLeft, windowLabel } from '../utils/format'

const STATUS: Record<
  DeliveryRecord['status'],
  { label: string; tone: 'success' | 'warning' | 'danger'; help: string }
> = {
  verified: {
    label: 'Delivered',
    tone: 'success',
    help: 'A courier and a package were clearly seen, so the box opened.',
  },
  needs_review: {
    label: 'At the door',
    tone: 'warning',
    help: 'A package was seen, but no courier clearly, so the box stayed locked.',
  },
  taken: { label: 'Picked up', tone: 'danger', help: 'Someone later picked the package up from the door.' },
}

function ParcelBox({ lock, now }: { lock?: LockState; now: number }) {
  const [code, setCode] = useState('')
  const [pending, setPending] = useState<'unlock' | 'lock' | 'reset'>()
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()

  const remaining = secondsLeft(lock?.unlockedUntil, now)
  const open = !!lock && !lock.locked && remaining > 0
  const activeCode = lock?.activeCode && lock.activeCode.expiresAt > now ? lock.activeCode : undefined

  const act = async (action: 'unlock' | 'lock' | 'reset') => {
    if (pending) return
    if (action === 'reset' && !window.confirm('Reset the simulated parcel box? This clears its log.')) return
    setPending(action)
    setMessage(undefined)
    try {
      await postJson('/api/parcel-box', { action, code })
      setCode('')
      setMessage({
        tone: 'success',
        text: { unlock: 'Box opened.', lock: 'Box locked.', reset: 'Simulator reset.' }[action],
      })
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(err) })
    } finally {
      setPending(undefined)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.length === 6) void act('unlock')
  }

  return (
    <Card className="p-5 sm:p-6" aria-labelledby="box-heading">
      <SectionTitle
        id="box-heading"
        action={<Badge title="Ring's API can't control locks, so this box is simulated">Simulated</Badge>}
      >
        Parcel box
      </SectionTitle>

      <div role="status" className={`flex items-center gap-4 rounded-2xl p-4 ${open ? 'bg-success/10' : 'bg-subtle'}`}>
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${open ? 'bg-success text-white' : 'bg-surface text-muted'}`}
        >
          <Icon name={open ? 'unlock' : 'lock'} className="h-6 w-6" />
        </span>
        <div>
          <p className="text-lg font-semibold">{open ? 'Open for delivery' : 'Locked'}</p>
          <p className="text-sm text-muted">
            {open
              ? `Locks again in ${remaining}s`
              : activeCode
                ? `Code ready until ${clockTime(activeCode.expiresAt)}`
                : 'Opens for verified couriers'}
          </p>
        </div>
      </div>

      {activeCode && (
        <p className="mt-4 text-sm text-muted">
          One-time code{' '}
          <span className="ml-1 font-mono text-xl font-semibold tracking-[0.2em] text-ink">{activeCode.code}</span>
        </p>
      )}

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <label htmlFor="code" className="sr-only">
          One-time code
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit code"
          className="h-11 w-full min-w-0 rounded-full border border-line bg-surface px-4 font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-muted"
        />
        <Button type="submit" disabled={code.length !== 6} loading={pending === 'unlock'}>
          Unlock
        </Button>
      </form>

      <p className="mt-2 text-xs text-muted">
        A one-time code is issued when a courier and a package are clearly seen on camera.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {open && (
          <Button
            size="sm"
            variant="secondary"
            icon="lock"
            onClick={() => void act('lock')}
            loading={pending === 'lock'}
          >
            Lock now
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          icon="refresh"
          onClick={() => void act('reset')}
          loading={pending === 'reset'}
        >
          Reset simulator
        </Button>
      </div>
      {message && (
        <div className="mt-3">
          <InlineMessage tone={message.tone}>{message.text}</InlineMessage>
        </div>
      )}

      <details className="mt-5 border-t border-line pt-4">
        <summary className="cursor-pointer text-sm font-semibold">Box log ({lock?.log.length ?? 0})</summary>
        <ol className="mt-3 max-h-60 space-y-2 overflow-y-auto text-sm">
          {(lock?.log ?? []).map((entry, i) => (
            <li key={`${entry.at}-${i}`} className="flex gap-3">
              <time className="w-20 shrink-0 text-muted">{clockTime(entry.at)}</time>
              <span>{entry.detail}</span>
            </li>
          ))}
          {!lock?.log.length && <li className="text-muted">Nothing yet.</li>}
        </ol>
      </details>
    </Card>
  )
}

function ExpectedParcels({ now }: { now: number }) {
  const { expectations } = useApp()
  const parcels = expectations
    .filter((x) => x.kind === 'parcel' && x.status !== 'cancelled' && x.until + GRACE_MS > now - 12 * 3600_000)
    .sort((a, b) => a.from - b.from)
  if (!parcels.length) return null
  return (
    <ul className="mb-4 space-y-2 rounded-2xl bg-subtle p-3">
      {parcels.map((x) => {
        const status = effectiveStatus(x, now)
        return (
          <li key={x.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Expected: {x.label}</span>
            <span className="text-muted">{windowLabel(x.from, x.until, now)}</span>
            <Badge tone={status === 'arrived' ? 'success' : status === 'missed' ? 'neutral' : 'primary'}>
              {status === 'arrived'
                ? `Arrived ${x.matchedAt ? clockTime(x.matchedAt) : ''}`
                : status === 'missed'
                  ? "Didn't arrive"
                  : 'Waiting'}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}

export default function DeliveriesPage() {
  const { deliveries, events, lock, loaded } = useApp()
  const now = useNow()
  const byId = new Map(events.map((e) => [e.id, e]))

  return (
    <Container>
      <PageHeader
        title="Deliveries"
        subtitle="Every package seen at your door, with a timestamped photo, and an alert if it's picked up."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="min-w-0 lg:order-2">
          <Card className="p-5 sm:p-6" aria-labelledby="pod-heading">
            <SectionTitle id="pod-heading">Packages</SectionTitle>
            <ExpectedParcels now={now} />
            {loaded && deliveries.length === 0 ? (
              <EmptyState icon="box" title="No packages yet">
                <p>When a package shows up at your door, it appears here with a photo and time.</p>
                <ol className="mx-auto mt-3 max-w-xs list-decimal space-y-1 pl-5 text-left">
                  <li>In the Ring Developer Playground, start the Package simulation.</li>
                  <li>
                    On Home, press <strong>Start live view</strong>, then <strong>Describe now</strong> or turn on{' '}
                    <strong>Keep watching</strong>.
                  </li>
                </ol>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link
                    href="/#live-heading"
                    className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-on hover:bg-primary-hover"
                  >
                    Go to live view
                  </Link>
                  <Link
                    href="/#expected-heading"
                    className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm font-semibold hover:bg-subtle"
                  >
                    Expect a parcel
                  </Link>
                </div>
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {deliveries.map((d) => {
                  const drop = byId.get(d.eventId)
                  const taken = d.takenEventId ? byId.get(d.takenEventId) : undefined
                  const s = STATUS[d.status]
                  return (
                    <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={s.tone} title={s.help}>
                          {s.label}
                        </Badge>
                        <span className="text-sm text-muted">{relativeTime(d.at, now)}</span>
                        {d.carrierGuess && <span className="text-sm text-muted">· {d.carrierGuess}</span>}
                        {d.expectedLabel && <Badge tone="success">Possibly {d.expectedLabel}</Badge>}
                      </div>
                      <p className="mt-2 break-words">{d.summary}</p>
                      {(drop || taken) && (
                        <div className="mt-3 flex gap-3">
                          {drop && (
                            <figure className="w-36">
                              <EventThumb event={drop} className="aspect-video w-full rounded-xl" />
                              <figcaption className="mt-1 text-xs text-muted">
                                Arrived {clockTime(drop.start)}
                              </figcaption>
                            </figure>
                          )}
                          {taken && (
                            <figure className="w-36">
                              <EventThumb event={taken} className="aspect-video w-full rounded-xl" />
                              <figcaption className="mt-1 text-xs text-danger">
                                Picked up {clockTime(taken.start)}
                              </figcaption>
                            </figure>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
        <div className="min-w-0 lg:order-1">
          <ParcelBox lock={lock} now={now} />
        </div>
      </div>
    </Container>
  )
}
