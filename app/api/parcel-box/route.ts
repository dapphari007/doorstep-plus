import { NextRequest, NextResponse } from 'next/server'
import { getLock, manualAction } from '@/lib/delivery/lock'
import { blockedInDemo } from '@/lib/demo'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ lock: await getLock() })
}

/** Simulated parcel box controls: { action: 'lock' | 'unlock' | 'reset', code? } */
export async function POST(req: NextRequest) {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  const { action, code } = await req.json()
  if (!['lock', 'unlock', 'reset'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  try {
    return NextResponse.json({ lock: await manualAction(action, code) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Lock error' }, { status: 403 })
  }
}
