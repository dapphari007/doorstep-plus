'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PATTERNS, alertKindFor } from '@/lib/alerts'
import { EventCard, Thumb, timeLabel } from './components/EventCard'
import { LivePanel } from './components/LivePanel'
import { PROFILES, useApp } from './components/ProfileProvider'
import { useStatus } from './hooks/useStatus'

export default function DoorstepPage() {
  const { events, profile } = useApp()
  const { status } = useStatus()
  const [checking, setChecking] = useState(false)

  const latest = useMemo(() => events.find((e) => e.status === 'described' && !e.repeatOf), [events])
  // Hide live-view sessions Ring couldn't give us media for, and repeated frames.
  const recent = events
    .filter((e) => !(e.ringType === 'on_demand' && (e.status === 'no_media' || e.status === 'error')) && !e.repeatOf)
    .slice(0, 30)
  const pattern = PATTERNS[alertKindFor(latest?.perception)]

  const checkNow = async () => {
    setChecking(true)
    await fetch('/api/poll', { method: 'POST' })
    setChecking(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Front door</h1>
          <p className="mt-1 text-slate-300">
            Alerts tuned for: <strong className="text-white">{PROFILES[profile].label}</strong> —{' '}
            {PROFILES[profile].blurb}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PollerBadge status={status} />
          <button className="btn-ghost" onClick={checkNow} disabled={checking || status?.fixtures}>
            {checking ? 'Checking…' : 'Check Ring now'}
          </button>
        </div>
      </div>

      {status && !status.fixtures && !status.ring.connected && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-100">
          Ring isn’t connected yet. <Link href="/settings" className="font-bold underline">Paste a Playground token in Settings</Link> to start.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0 space-y-6">
          <section className="card" aria-labelledby="latest-heading" style={{ borderColor: latest ? pattern.color : undefined }}>
            <h2 id="latest-heading" className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Right now at your door
            </h2>
            {latest?.perception ? (
              <div className="mt-3 flex flex-col gap-4 sm:flex-row">
                <Thumb event={latest} className="aspect-video w-full sm:w-56" />
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: pattern.color }}>
                    {pattern.icon} {pattern.label} · {timeLabel(latest.start)}
                  </p>
                  <p className="mt-1 text-3xl font-bold leading-tight text-white">{latest.perception.caption}</p>
                  <p className="mt-2 text-slate-300">{latest.perception.details}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-2xl text-slate-300">Nothing yet. New activity will appear here and alert you.</p>
            )}
          </section>
          <LivePanel fixtures={!!status?.fixtures} />
        </div>

        <section aria-labelledby="feed-heading" className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="feed-heading" className="text-lg font-bold text-white">
              Recent activity
            </h2>
            <Link href="/recall" className="text-sm font-semibold text-sky-300 hover:underline">
              Ask about past events →
            </Link>
          </div>
          {recent.length === 0 && <p className="text-slate-400">No events yet.</p>}
          <ol className="space-y-3">
            {recent.map((e) => (
              <li key={e.id}>
                <EventCard event={e} compact />
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

function PollerBadge({ status }: { status?: ReturnType<typeof useStatus>['status'] }) {
  if (!status) return null
  if (status.fixtures) return <span className="pill bg-fuchsia-500/20 text-fuchsia-200">Fixture mode</span>
  if (status.poller.lastError)
    return (
      <span className="pill max-w-xs truncate bg-amber-500/15 text-amber-200" title={status.poller.lastError}>
        ⚠ {status.poller.lastError}
      </span>
    )
  if (status.poller.lastSuccessAt)
    return (
      <span className="pill bg-emerald-500/15 text-emerald-200">
        Watching Ring · checked {new Date(status.poller.lastSuccessAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
      </span>
    )
  return null
}
