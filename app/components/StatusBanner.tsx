'use client'

import Link from 'next/link'
import { useApp } from '../providers/AppProvider'

/** Slim blue strip across the top for whatever most needs attention. */
export function StatusBanner() {
  const { status, serverOffline } = useApp()
  let text: string | undefined
  let action: { href: string; label: string } | undefined

  if (serverOffline) {
    text = "Can't reach the Doorstep server. Retrying…"
  } else if (status?.demo) {
    text =
      'Read-only demo with recorded Ring Playground events. Try Ask, the filters, and "Play a sample alert" with each alert profile.'
  } else if (!status) {
    return null
  } else if (status.fixtures) {
    text = 'Test mode is on. Events are fake, not from Ring.'
  } else if (!status.ring.connected) {
    text = 'Connect your Ring account to start watching your door.'
    action = { href: '/settings', label: 'Connect' }
  } else if (status.poller.lastError) {
    const expired = /token/i.test(status.poller.lastError)
    text = expired ? 'Your Ring session has expired.' : status.poller.lastError
    action = expired ? { href: '/settings', label: 'Reconnect' } : undefined
  } else if (!status.aws.credentials) {
    text = 'AI descriptions are off: no AWS credentials found.'
  }

  if (!text) return null
  return (
    <div role="status" className="bg-primary text-primary-on">
      <div className="flex min-h-11 items-center justify-center gap-3 px-4 py-2 text-center text-sm sm:text-[15px]">
        <p>{text}</p>
        {action && (
          <Link href={action.href} className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  )
}
