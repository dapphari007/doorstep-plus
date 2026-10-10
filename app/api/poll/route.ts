import { NextResponse } from 'next/server'
import { pollOnce, pollerStatus } from '@/lib/ring/poller'

export const dynamic = 'force-dynamic'

/** "Check now" button: poll Ring event history immediately. */
export async function POST() {
  const queued = await pollOnce()
  return NextResponse.json({ queued, poller: pollerStatus() })
}
