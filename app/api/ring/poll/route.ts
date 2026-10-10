import { NextResponse } from 'next/server'
import { pollOnce, pollerStatus } from '@/lib/ring/poller'
import { blockedInDemo } from '@/lib/demo'

export const dynamic = 'force-dynamic'

/** "Check now" button: poll Ring event history immediately. */
export async function POST() {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  const queued = await pollOnce()
  return NextResponse.json({ queued, poller: pollerStatus() })
}
