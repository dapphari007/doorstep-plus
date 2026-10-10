import { NextRequest, NextResponse } from 'next/server'
import { resolveDeviceId, startWhepSession, stopWhepSession } from '@/lib/ring/client'
import { blockedInDemo } from '@/lib/demo'

/** WHEP signalling proxy: the browser sends its SDP offer, we forward it to Ring. */
export async function POST(req: NextRequest) {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  try {
    const { sdpOffer, deviceId } = await req.json()
    if (!sdpOffer) return NextResponse.json({ error: 'Missing sdpOffer' }, { status: 400 })
    return NextResponse.json(await startWhepSession(deviceId || (await resolveDeviceId()), sdpOffer))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stream failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  try {
    const { sessionUrl } = await req.json()
    if (!sessionUrl) return NextResponse.json({ error: 'Missing sessionUrl' }, { status: 400 })
    await stopWhepSession(sessionUrl)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Close failed' }, { status: 500 })
  }
}
