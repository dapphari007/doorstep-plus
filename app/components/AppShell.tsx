'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useApp } from '../providers/AppProvider'
import { PROFILES, isProfileId } from '../utils/profiles'
import { StatusBanner } from './StatusBanner'
import { Wordmark } from './Wordmark'
import { Icon, type IconName } from './ui/Icon'
import { Select } from './ui/Select'

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/recall', label: 'Ask', icon: 'chat' },
  { href: '/deliveries', label: 'Deliveries', icon: 'box' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
]

function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path.startsWith(href)
}

function ProfileSelect({ compact = false }: { compact?: boolean }) {
  const { profile, setProfile } = useApp()
  return (
    <Select
      value={profile}
      onChange={(e) => isProfileId(e.target.value) && setProfile(e.target.value)}
      aria-label="Alert profile"
      className={compact ? 'w-36' : 'w-56'}
    >
      {Object.entries(PROFILES).map(([id, p]) => (
        <option key={id} value={id}>
          {compact ? p.short : p.label}
        </option>
      ))}
    </Select>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname()

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-on"
      >
        Skip to content
      </a>

      <div className="sticky top-0 z-30">
        <StatusBanner />
        <header className="border-b border-line bg-surface">
          <div className="flex h-16 items-center gap-10 px-4 sm:px-8 md:h-20 lg:px-16">
            <Wordmark />

            <nav aria-label="Main" className="hidden h-full items-stretch gap-8 md:flex">
              {NAV.map((item) => {
                const active = isActive(path, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center border-b-2 text-[17px] font-medium transition-colors ${
                      active ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="ml-auto flex items-center gap-5">
              <span className="hidden sm:block">
                <ProfileSelect />
              </span>
              <span className="sm:hidden">
                <ProfileSelect compact />
              </span>
            </div>
          </div>
        </header>
      </div>

      <main id="main" className="pb-28 md:pb-16">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(path, item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${active ? 'text-primary' : 'text-muted'}`}
                >
                  <Icon name={item.icon} className="h-6 w-6" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
