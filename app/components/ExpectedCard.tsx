'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { GRACE_MS, effectiveStatus, type EffectiveStatus } from '@/lib/expectations/match'
import type { Expectation } from '@/lib/types'
import { useApp } from '../providers/AppProvider'
import { clockTime, errorMessage, fetchJson, localClockToEpoch, postJson, windowLabel } from '../utils/format'
import { readDeviceName, writeDeviceName } from '../utils/profiles'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { InlineMessage } from './ui/EmptyState'
import { Icon, type IconName } from './ui/Icon'

const ICON: Record<Expectation['kind'], IconName> = { visitor: 'person', parcel: 'box', household: 'home' }
const SHOW_FOR_MS = 12 * 3600_000

function nextHour(): { from: string; to: string } {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  const to = new Date(d.getTime() + 3600_000)
  return { from: `${pad(d.getHours())}:00`, to: `${pad(to.getHours())}:00` }
}

function StatusBadge({ status, x }: { status: EffectiveStatus; x: Expectation }) {
  if (status === 'arrived') return <Badge tone="success">Arrived {x.matchedAt ? clockTime(x.matchedAt) : ''}</Badge>
  if (status === 'missed') return <Badge tone="neutral">Didn't arrive</Badge>
  return <Badge tone="primary">Waiting</Badge>
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<'visitor' | 'parcel'>('visitor')
  const [label, setLabel] = useState('')
  const [day, setDay] = useState<0 | 1>(0)
  const [anyTime, setAnyTime] = useState(false)
  const [times, setTimes] = useState(nextHour)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => setAnyTime(kind === 'parcel'), [kind])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const from = anyTime ? Math.max(Date.now(), localClockToEpoch('00:00', day)) : localClockToEpoch(times.from, day)
    let until = anyTime ? localClockToEpoch('23:59', day) : localClockToEpoch(times.to, day)
    if (!anyTime && until <= from) until += 24 * 3600_000 // e.g. 11 PM to 1 AM
    setSaving(true)
    setError(undefined)
    try {
      await postJson('/api/expectations', {
        kind,
        label: label.trim() || (kind === 'parcel' ? 'Parcel' : 'Visitor'),
        from,
        until,
      })
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const field = 'h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px]'
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl bg-subtle p-4">
      <div
        role="radiogroup"
        aria-label="What are you expecting?"
        className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1"
      >
        {(['visitor', 'parcel'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`h-9 rounded-full text-sm font-semibold transition-colors ${kind === k ? 'bg-primary text-primary-on' : 'text-muted hover:text-ink'}`}
          >
            {k === 'visitor' ? 'A visitor' : 'A parcel'}
          </button>
        ))}
      </div>
      <label className="block text-sm font-medium">
        {kind === 'visitor' ? 'Who?' : 'Which parcel?'}
        <input
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={kind === 'visitor' ? 'Plumber' : 'Amazon parcel'}
          className={`${field} mt-1`}
          autoFocus
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Day
          <select value={day} onChange={(e) => setDay(Number(e.target.value) as 0 | 1)} className={`${field} mt-1`}>
            <option value={0}>Today</option>
            <option value={1}>Tomorrow</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-3 text-sm font-medium">
          <input type="checkbox" checked={anyTime} onChange={(e) => setAnyTime(e.target.checked)} className="h-4 w-4" />
          Any time
        </label>
      </div>
      {!anyTime && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            From
            <input
              type="time"
              required
              value={times.from}
              onChange={(e) => setTimes((t) => ({ ...t, from: e.target.value }))}
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-sm font-medium">
            To
            <input
              type="time"
              required
              value={times.to}
              onChange={(e) => setTimes((t) => ({ ...t, to: e.target.value }))}
              className={`${field} mt-1`}
            />
          </label>
        </div>
      )}
      {error && <InlineMessage tone="danger">{error}</InlineMessage>}
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          Save
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted">
        Matched by time and what the camera sees, never by face. Alerts say "possibly".
      </p>
    </form>
  )
}

function HeadingHome() {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()

  useEffect(() => {
    const stored = readDeviceName()
    if (stored) setSaved(stored)
  }, [])

  const go = async () => {
    const who = (saved ?? name).trim()
    if (!who || busy) return
    setBusy(true)
    setMessage(undefined)
    try {
      await postJson('/api/expectations', { kind: 'household', label: who })
      if (!saved) {
        writeDeviceName(who)
        setSaved(who)
      }
      setMessage({ tone: 'success', text: `Got it. ${who} is expected in the next 30 minutes.` })
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      {saved ? (
        <Button variant="secondary" icon="home" loading={busy} onClick={go} block>
          I'm heading home ({saved})
        </Button>
      ) : (
        <div className="flex gap-2">
          <label htmlFor="device-name" className="sr-only">
            Your name
          </label>
          <input
            id="device-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[15px]"
          />
          <Button variant="secondary" icon="home" loading={busy} onClick={go} disabled={!name.trim()}>
            Heading home
          </Button>
        </div>
      )}
      {message && (
        <div className="mt-2">
          <InlineMessage tone={message.tone}>{message.text}</InlineMessage>
        </div>
      )}
    </div>
  )
}

export function ExpectedCard({ now }: { now: number }) {
  const { expectations } = useApp()
  const [adding, setAdding] = useState(false)
  const [cancelling, setCancelling] = useState<string>()
  const [error, setError] = useState<string>()

  const items = useMemo(
    () =>
      expectations
        .filter((x) => x.status !== 'cancelled' && x.until + GRACE_MS > now - SHOW_FOR_MS)
        .map((x) => ({ x, status: effectiveStatus(x, now) }))
        .sort((a, b) => Number(b.status === 'waiting') - Number(a.status === 'waiting') || a.x.from - b.x.from),
    [expectations, now],
  )

  const cancel = async (id: string) => {
    setCancelling(id)
    setError(undefined)
    try {
      await fetchJson(`/api/expectations?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCancelling(undefined)
    }
  }

  return (
    <section aria-labelledby="expected-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="expected-heading" className="text-lg font-semibold">
          Expecting someone?
        </h2>
        {!adding && (
          <Button size="sm" variant="secondary" icon="plus" onClick={() => setAdding(true)}>
            Add
          </Button>
        )}
      </div>

      {items.length === 0 && !adding && (
        <p className="mt-2 text-sm text-muted">
          Add a plumber, a guest or a parcel and alerts will say "possibly your plumber".
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {items.map(({ x, status }) => (
            <li key={x.id} className="flex items-center gap-3 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-subtle text-muted">
                <Icon name={ICON[x.kind]} className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{x.kind === 'household' ? `${x.label} heading home` : x.label}</p>
                <p className="text-sm text-muted">{windowLabel(x.from, x.until, now)}</p>
              </div>
              <StatusBadge status={status} x={x} />
              {status === 'waiting' && (
                <button
                  type="button"
                  onClick={() => void cancel(x.id)}
                  disabled={cancelling === x.id}
                  aria-label={`Cancel ${x.label}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle disabled:opacity-50"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <InlineMessage tone="danger">{error}</InlineMessage>}
      {adding && <AddForm onDone={() => setAdding(false)} />}
      <HeadingHome />
    </section>
  )
}
