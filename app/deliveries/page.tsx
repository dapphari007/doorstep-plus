'use client'

import { useEffect, useState } from 'react'
import type { DeliveryRecord } from '@/lib/types'
import { Thumb, timeLabel } from '../components/EventCard'
import { useApp } from '../components/ProfileProvider'

const STATUS: Record<DeliveryRecord['status'], { label: string; cls: string; help: string }> = {
  verified: {
    label: 'Verified drop-off',
    cls: 'bg-emerald-500/15 text-emerald-200',
    help: 'A delivery person and a package were clearly visible, so the parcel box opened.',
  },
  needs_review: {
    label: 'Needs a look',
    cls: 'bg-amber-500/15 text-amber-200',
    help: 'A package appeared but the courier wasn’t clear enough to open the box automatically.',
  },
  taken: {
    label: 'Picked up',
    cls: 'bg-red-500/15 text-red-200',
    help: 'Someone later picked the package up from the door.',
  },
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, ms)
    // Background tabs throttle timers; catch up as soon as the tab is visible.
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [ms])
  return now
}

export default function DeliveriesPage() {
  const { deliveries, events, lock } = useApp()
  const now = useNow()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string>()
  const byId = new Map(events.map((e) => [e.id, e]))

  const act = async (action: 'lock' | 'unlock' | 'reset') => {
    setMsg(undefined)
    const res = await fetch('/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, code }),
    })
    const body = await res.json()
    if (!res.ok) setMsg(body.error)
    else setCode('')
  }

  const open = lock && !lock.locked && (lock.unlockedUntil ?? 0) > now
  const secondsLeft = open ? Math.ceil(((lock!.unlockedUntil ?? now) - now) / 1000) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Deliveries</h1>
        <p className="mt-1 max-w-3xl text-slate-300">
          When Ring sees a courier drop off a package, Doorstep Copilot checks the footage, opens the parcel box for two
          minutes with a one-time code, and keeps a timestamped proof-of-delivery record. If the package is later picked
          up, you’re alerted.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="card space-y-4" aria-labelledby="lock-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="lock-heading" className="text-lg font-bold text-white">
              Parcel box
            </h2>
            <span className="pill bg-fuchsia-500/20 text-fuchsia-200" title="Ring’s API cannot control locks; this box is simulated">
              Simulated lock
            </span>
          </div>
          <div
            className={`rounded-2xl p-5 text-center ${open ? 'bg-emerald-500/15' : 'bg-ink-800'}`}
            role="status"
            aria-live="polite"
          >
            <p className="text-5xl" aria-hidden="true">
              {open ? '🔓' : '🔒'}
            </p>
            <p className="mt-2 text-2xl font-bold text-white">{open ? 'Open for delivery' : 'Locked'}</p>
            {open && <p className="text-emerald-200">Re-locks automatically in {secondsLeft}s</p>}
            {lock?.activeCode && lock.activeCode.expiresAt > now && (
              <p className="mt-2 text-slate-300">
                One-time code <span className="font-mono text-xl font-bold tracking-widest text-white">{lock.activeCode.code}</span>{' '}
                · expires {timeLabel(lock.activeCode.expiresAt)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="code">
              One-time code
            </label>
            <input
              id="code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Code"
              className="w-28 rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 font-mono text-white"
            />
            <button className="btn-ghost" onClick={() => act('unlock')} disabled={code.length !== 6}>
              Unlock with code
            </button>
            <button className="btn-ghost" onClick={() => act('lock')}>
              Lock now
            </button>
            <button className="btn-ghost text-sm" onClick={() => act('reset')}>
              Reset simulator
            </button>
          </div>
          {msg && (
            <p role="alert" className="text-amber-300">
              {msg}
            </p>
          )}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">Box log</h3>
            <ol className="mt-2 max-h-64 space-y-1.5 overflow-y-auto text-sm">
              {(lock?.log ?? []).map((l, i) => (
                <li key={i} className="flex gap-3">
                  <time className="shrink-0 text-slate-500">{timeLabel(l.at)}</time>
                  <span className="text-slate-200">{l.detail}</span>
                </li>
              ))}
              {!lock?.log.length && <li className="text-slate-500">Nothing yet.</li>}
            </ol>
          </div>
        </section>

        <section aria-labelledby="pod-heading" className="space-y-3">
          <h2 id="pod-heading" className="text-lg font-bold text-white">
            Proof of delivery
          </h2>
          {deliveries.length === 0 && (
            <p className="text-slate-400">
              No deliveries yet. In the Ring Developer Playground, start the <strong>Package</strong> live-view simulation.
            </p>
          )}
          <ol className="space-y-3">
            {deliveries.map((d) => {
              const drop = byId.get(d.eventId)
              const taken = d.takenEventId ? byId.get(d.takenEventId) : undefined
              const s = STATUS[d.status]
              return (
                <li key={d.id} className="card space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`pill ${s.cls}`} title={s.help}>
                      {s.label}
                    </span>
                    <time className="text-sm text-slate-400">{timeLabel(d.at)}</time>
                    {d.carrierGuess && <span className="pill bg-ink-700 text-slate-200">Looks like {d.carrierGuess}</span>}
                  </div>
                  <p className="text-white">{d.summary}</p>
                  <div className="flex flex-wrap gap-3">
                    {drop && (
                      <figure className="space-y-1">
                        <Thumb event={drop} className="h-28 w-48" />
                        <figcaption className="text-xs text-slate-400">Drop-off · {timeLabel(drop.start)}</figcaption>
                      </figure>
                    )}
                    {taken && (
                      <figure className="space-y-1">
                        <Thumb event={taken} className="h-28 w-48" />
                        <figcaption className="text-xs text-red-300">Picked up · {timeLabel(taken.start)}</figcaption>
                      </figure>
                    )}
                  </div>
                  {d.code && <p className="text-sm text-slate-400">Box code issued: <span className="font-mono">{d.code}</span></p>}
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </div>
  )
}
