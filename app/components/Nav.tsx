'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PROFILES, useApp, type ProfileId } from './ProfileProvider'

const LINKS = [
  { href: '/', label: 'Doorstep' },
  { href: '/recall', label: 'Recall' },
  { href: '/deliveries', label: 'Deliveries' },
  { href: '/settings', label: 'Settings' },
]

export function Nav() {
  const path = usePathname()
  const { profile, setProfile, connected } = useApp()
  return (
    <header className="border-b border-ink-700 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-ring-blue text-base">
            ◉
          </span>
          Doorstep Copilot
        </Link>
        <nav aria-label="Main" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {LINKS.map((l) => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold ${
                  active ? 'bg-ink-800 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span
            className={`pill ${connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}
            title={connected ? 'Receiving live events' : 'Reconnecting to live events'}
          >
            <span aria-hidden="true">●</span> {connected ? 'Live' : 'Offline'}
          </span>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span className="hidden sm:inline">Alerts for</span>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as ProfileId)}
              className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 font-semibold text-white"
            >
              {Object.entries(PROFILES).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  )
}
