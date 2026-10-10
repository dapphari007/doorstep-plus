'use client'

import { useState } from 'react'
import { PROFILES, useApp, type AlertPrefs, type ProfileId } from '../components/ProfileProvider'
import { useStatus } from '../hooks/useStatus'

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className={ok ? 'text-emerald-400' : 'text-amber-400'}>
        {ok ? '✔' : '●'}
      </span>
      <span>
        <span className="font-semibold text-white">{label}</span>
        {detail && <span className="block text-sm text-slate-400">{detail}</span>}
      </span>
    </li>
  )
}

export default function SettingsPage() {
  const { profile, setProfile, prefs, setPrefs } = useApp()
  const { status, reload } = useStatus(4000)
  const [token, setToken] = useState('')
  const [msg, setMsg] = useState<string>()

  const saveToken = async () => {
    setMsg(undefined)
    const res = await fetch('/api/ring/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const body = await res.json()
    setMsg(res.ok ? 'Connected. Watching for new Ring events.' : body.error)
    if (res.ok) setToken('')
    void reload()
  }

  const toggle = (k: keyof AlertPrefs) => setPrefs({ ...prefs, [k]: !prefs[k] })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold text-white">Settings</h1>

      <section className="card space-y-4" aria-labelledby="ring-heading">
        <h2 id="ring-heading" className="text-lg font-bold text-white">
          Connect Ring
        </h2>
        <p className="text-slate-300">
          Open the{' '}
          <a className="font-semibold text-sky-300 underline" href="https://developer.amazon.com/ring/console/playground" target="_blank" rel="noreferrer">
            Ring Developer Playground
          </a>
          , click <strong>Generate Token</strong>, and paste it here. Playground tokens last about 30 minutes. The token stays
          in this server’s memory and is never sent back to the browser.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="token" className="sr-only">
            Ring access token
          </label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJ…"
            className="min-w-0 flex-1 rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 font-mono text-white"
            autoComplete="off"
          />
          <button className="btn-primary" onClick={saveToken} disabled={token.trim().length < 20}>
            Connect
          </button>
        </div>
        {msg && <p role="status" className="text-slate-200">{msg}</p>}
      </section>

      <section className="card" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-lg font-bold text-white">
          System check
        </h2>
        {status ? (
          <ul className="mt-3 space-y-3">
            {status.fixtures && <Check ok={false} label="Fixture mode is ON" detail="Events are fake. Turn off FIXTURE_MODE for the real demo." />}
            <Check
              ok={status.ring.connected}
              label="Ring Partner API"
              detail={status.ring.connected ? `Connected (${status.ring.mode})${status.poller.deviceId ? ` · device ${status.poller.deviceId}` : ''}` : 'Not connected'}
            />
            <Check
              ok={!!status.poller.lastSuccessAt && !status.poller.lastError}
              label="Event history polling"
              detail={status.poller.lastError ?? (status.poller.lastSuccessAt ? `Last checked ${new Date(status.poller.lastSuccessAt).toLocaleTimeString()}` : 'Waiting for Ring')}
            />
            <Check
              ok={status.aws.credentials}
              label="Amazon Bedrock"
              detail={`${status.aws.credentials ? 'Credentials found' : 'No AWS credentials found'} · ${status.aws.region} · vision: ${status.aws.perceptionModel} · agent: ${status.aws.agentModel}`}
            />
            <Check ok={status.aws.store === 'aws'} label="Storage" detail={status.aws.store === 'aws' ? 'DynamoDB + S3' : 'Local files (.data/)'} />
            <Check ok={status.lightWebhook} label="Smart-light webhook" detail={status.lightWebhook ? 'Configured' : 'Optional: set LIGHT_WEBHOOK_URL to flash a real lamp'} />
          </ul>
        ) : (
          <p className="mt-3 text-slate-400">Loading…</p>
        )}
      </section>

      <section className="card space-y-4" aria-labelledby="alerts-heading">
        <h2 id="alerts-heading" className="text-lg font-bold text-white">
          How you’re alerted
        </h2>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Profile</legend>
          {Object.entries(PROFILES).map(([id, p]) => (
            <label
              key={id}
              className={`cursor-pointer rounded-xl border p-3 ${profile === id ? 'border-ring-blue bg-ring-blue/10' : 'border-ink-600'}`}
            >
              <input
                type="radio"
                name="profile"
                className="sr-only"
                checked={profile === id}
                onChange={() => setProfile(id as ProfileId)}
              />
              <span className="font-bold text-white">{p.label}</span>
              <span className="block text-sm text-slate-300">{p.blurb}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ['flash', 'Screen flash'],
              ['vibrate', 'Vibration'],
              ['speak', 'Speak aloud'],
              ['chime', 'Chime'],
            ] as [keyof AlertPrefs, string][]
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-slate-200">
              <input type="checkbox" className="h-5 w-5" checked={prefs[k]} onChange={() => toggle(k)} />
              {label}
            </label>
          ))}
        </div>
        <p className="text-sm text-slate-400">
          Browsers only allow sound and speech after you’ve clicked somewhere on the page once.
        </p>
      </section>

      <section className="card space-y-2" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="text-lg font-bold text-white">
          Privacy promise
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>Descriptions say what is happening, never who someone is. No face recognition, no licence plates.</li>
          <li>A safety check edits every AI description before it’s shown or spoken, and tells you what it changed.</li>
          <li>Only events after you connect are read, and only from devices you share in the Ring app.</li>
        </ul>
      </section>
    </div>
  )
}
