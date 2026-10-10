import { NextRequest, NextResponse } from 'next/server'
import { setRuntimeAccessToken } from '@/lib/ring/auth'
import { pollOnce } from '@/lib/ring/poller'
import { blockedInDemo } from '@/lib/demo'

// Playground tokens expire after ~30 min; this keeps the new one in memory only.
export async function POST(req: NextRequest) {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  const { token } = await req.json()
  if (typeof token !== 'string' || token.trim().length < 20) {
    return NextResponse.json({ error: 'That does not look like a Ring access token' }, { status: 400 })
  }
  setRuntimeAccessToken(token)
  await pollOnce()
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  setRuntimeAccessToken(undefined)
  return NextResponse.json({ ok: true })
}
