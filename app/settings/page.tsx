'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { alertKindForEvent, isSilent } from '@/lib/alerts'
import { StatusDot } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, Container, PageHeader, SectionTitle } from '../components/ui/Card'
import { InlineMessage } from '../components/ui/EmptyState'
import { Switch } from '../components/ui/Switch'
import { useApp } from '../providers/AppProvider'
import { clockTime, errorMessage, fetchJson, postJson } from '../utils/format'
import { PROFILES, readDeviceName, writeDeviceName, type AlertPrefs, type ProfileId } from '../utils/profiles'
import { chime, speak, vibrate } from '../utils/sound'

const PLAYGROUND_URL = 'https://developer.amazon.com/ring/console/playground'

function CheckRow({
  ok,
  label,
  detail,
  optional = false,
}: {
  ok: boolean
  label: string
  detail: ReactNode
  optional?: boolean
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-2">
        <StatusDot tone={ok ? 'success' : optional ? 'neutral' : 'warning'} />
      </span>
      <div className="min-w-0">
        <p className="font-medium">
          {label} <span className="sr-only">{ok ? '(ok)' : optional ? '(optional, off)' : '(needs attention)'}</span>
        </p>
        <p className="break-words text-sm text-muted">{detail}</p>
      </div>
    </li>
  )
}

function ConnectRing({ onConnected }: { onConnected: () => void }) {
  const [token, setToken] = useState('')
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = token.trim()
    if (value.length < 20 || saving) return
    setSaving(true)
    setMessage(undefined)
    try {
      await postJson('/api/ring/token', { token: value })
      setToken('')
      setMessage({ tone: 'success', text: 'Connected. Watching your door for new events.' })
      onConnected()
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(err, 'Could not connect') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">
        In the{' '}
        <a
          href={PLAYGROUND_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Ring Developer Playground
        </a>
        , choose <strong>Generate Token</strong> and paste it here. Tokens last about 30 minutes and are kept in server
        memory only.
      </p>
      <div className="flex gap-2">
        <label htmlFor="token" className="sr-only">
          Ring access token
        </label>
        <div className="relative min-w-0 flex-1">
          <input
            id="token"
            type={visible ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste token"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-full border border-line bg-surface pl-4 pr-16 font-mono text-sm placeholder:font-sans placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-subtle"
            aria-pressed={visible}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
        <Button type="submit" loading={saving} disabled={token.trim().length < 20}>
          Connect
        </Button>
      </div>
      {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}
    </form>
  )
}

function DeviceName() {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => setName(readDeviceName() ?? ''), [])
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    writeDeviceName(name)
    setSaved(true)
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <p className="text-sm text-muted">
        Used by "I'm heading home" so your arrival is announced as "possibly {name.trim() || 'you'} arriving home".
        Saved on this device only.
      </p>
      <div className="flex gap-2">
        <label htmlFor="device-name-setting" className="sr-only">
          Your name
        </label>
        <input
          id="device-name-setting"
          value={name}
          maxLength={40}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          placeholder="Your name"
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[15px]"
        />
        <Button type="submit" variant="secondary" disabled={!name.trim()}>
          Save
        </Button>
      </div>
      {saved && <InlineMessage tone="success">Saved.</InlineMessage>}
    </form>
  )
}

/** Deletes the app's activity history after a second, explicit confirmation. */
function ClearActivity() {
  const { refresh, status } = useApp()
  const demo = !!status?.demo
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()

  const clear = async () => {
    setBusy(true)
    setMessage(undefined)
    try {
      const { removed } = await fetchJson<{ removed: number }>('/api/activity', { method: 'DELETE' })
      setMessage({ tone: 'success', text: removed ? `Cleared ${removed} items.` : 'Nothing to clear.' })
      await refresh()
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(err, 'Could not clear the history.') })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <Card className="p-5 sm:p-6" aria-labelledby="activity-heading">
      <SectionTitle id="activity-heading">Your activity</SectionTitle>
      <p className="text-sm text-muted">
        Deletes every event, delivery and expected arrival saved by Doorstep. Recordings stay in your Ring account, and
        older Ring events are not imported again.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <Button variant="danger" loading={busy} onClick={() => void clear()}>
              Yes, clear history
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={demo}>
            Clear activity
          </Button>
        )}
      </div>
      {message && (
        <div className="mt-3">
          <InlineMessage tone={message.tone}>{message.text}</InlineMessage>
        </div>
      )}
    </Card>
  )
}

export default function SettingsPage() {
  const {
    profile,
    setProfile,
    prefs,
    setPrefs,
    status,
    serverOffline: offline,
    reloadStatus: reload,
    events,
    previewAlert,
  } = useApp()

  const setPref = (key: keyof AlertPrefs, value: boolean) => setPrefs({ ...prefs, [key]: value })

  // Replays your latest real event exactly as it would be announced; falls back to a plain test.
  const testAlert = () => {
    const latest = events.find((e) => e.status === 'described' && !e.repeatOf && !isSilent(alertKindForEvent(e)))
    if (latest) return previewAlert(latest)
    if (prefs.chime) chime()
    if (prefs.vibrate) vibrate([300, 150, 300])
    if (prefs.speak) speak('This is a test alert from Doorstep.')
  }

  const sessionExpired = !!status?.poller.lastError && /token/i.test(status.poller.lastError)
  const ringOk = !!status?.ring.connected && !sessionExpired

  const lastCheck = status?.poller.lastSuccessAt
    ? `Last checked ${clockTime(status.poller.lastSuccessAt)}`
    : 'Waiting for Ring'

  return (
    <Container>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader centered title="Settings" subtitle="Your Ring account, how you're alerted, and system health." />

        <Card className="p-5 sm:p-6" aria-labelledby="ring-heading">
          <SectionTitle id="ring-heading">Ring account</SectionTitle>
          {status?.demo ? (
            <p className="text-sm text-muted">
              This public demo shows recorded Ring Playground events. Connecting a Ring account is turned off here; run
              the app locally to connect your own.
            </p>
          ) : (
            <ConnectRing onConnected={() => void reload()} />
          )}
        </Card>

        <Card className="p-5 sm:p-6" aria-labelledby="household-heading">
          <SectionTitle id="household-heading">This device</SectionTitle>
          <DeviceName />
        </Card>

        <Card className="p-5 sm:p-6" aria-labelledby="alerts-heading">
          <SectionTitle
            id="alerts-heading"
            action={
              <Button size="sm" variant="secondary" onClick={testAlert}>
                Test alert
              </Button>
            }
          >
            How you're alerted
          </SectionTitle>
          <fieldset>
            <legend className="sr-only">Alert profile</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(PROFILES) as ProfileId[]).map((id) => (
                <label
                  key={id}
                  className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
                    profile === id ? 'border-primary bg-primary/5' : 'border-line hover:bg-subtle'
                  }`}
                >
                  <input
                    type="radio"
                    name="profile"
                    checked={profile === id}
                    onChange={() => setProfile(id)}
                    className="mt-1 h-4 w-4 accent-[rgb(var(--primary))]"
                  />
                  <span>
                    <span className="block font-semibold">{PROFILES[id].label}</span>
                    <span className="block text-sm text-muted">{PROFILES[id].blurb}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 divide-y divide-line border-t border-line">
            <Switch
              checked={prefs.flash}
              onChange={(v) => setPref('flash', v)}
              label="Screen flash"
              description="The screen flashes in the alert's colour and rhythm."
            />
            <Switch
              checked={prefs.vibrate}
              onChange={(v) => setPref('vibrate', v)}
              label="Vibration"
              description="On phones that support it."
            />
            <Switch
              checked={prefs.speak}
              onChange={(v) => setPref('speak', v)}
              label="Read aloud"
              description="Each alert is spoken. Press R to repeat."
            />
            <Switch checked={prefs.chime} onChange={(v) => setPref('chime', v)} label="Chime" />
          </div>
          <p className="mt-2 text-xs text-muted">
            Browsers only play sound after you've tapped or clicked the page once.
          </p>
        </Card>

        <ClearActivity />

        <Card className="p-5 sm:p-6" aria-labelledby="status-heading">
          <SectionTitle id="status-heading">System</SectionTitle>
          {offline ? (
            <InlineMessage tone="danger">Can't reach the Doorstep server.</InlineMessage>
          ) : !status ? (
            <p className="text-muted">Checking…</p>
          ) : (
            <ul className="divide-y divide-line">
              {status.fixtures && (
                <CheckRow
                  ok={false}
                  label="Test mode is on"
                  detail="Events are fake. Turn off FIXTURE_MODE for real Ring data."
                />
              )}
              <CheckRow
                ok={ringOk}
                label="Ring"
                detail={
                  !status.ring.connected
                    ? 'Not connected'
                    : sessionExpired
                      ? 'Session expired. Paste a new token above.'
                      : 'Connected'
                }
              />
              <CheckRow
                ok={!!status.poller.lastSuccessAt && !status.poller.lastError}
                label="Event checks"
                detail={status.poller.lastError ?? lastCheck}
              />
              <CheckRow
                ok={status.aws.credentials}
                label="AI descriptions (Amazon Bedrock)"
                detail={
                  status.aws.credentials
                    ? `${status.aws.perceptionModel} · ${status.aws.region}`
                    : 'No AWS credentials found'
                }
              />
              <CheckRow
                ok={status.aws.store === 'aws'}
                label="Storage"
                detail={status.aws.store === 'aws' ? 'Amazon DynamoDB + S3' : 'This computer only'}
              />
              <CheckRow
                optional
                ok={status.lightWebhook}
                label="Smart light"
                detail={status.lightWebhook ? 'Connected' : 'Optional: set LIGHT_WEBHOOK_URL'}
              />
            </ul>
          )}
        </Card>
      </div>
    </Container>
  )
}
