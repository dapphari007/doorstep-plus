import { NextRequest, NextResponse } from 'next/server'
import { downloadClip } from '@/lib/ring/client'
import { getStore } from '@/lib/store'
import { blockedInDemo } from '@/lib/demo'

export const runtime = 'nodejs'

/** Download the recorded clip around an event, named with the event's own time. */
export async function GET(req: NextRequest) {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  const id = req.nextUrl.searchParams.get('eventId')
  if (!id) return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  const event = await getStore().getEvent(id)
  if (!event) return NextResponse.json({ error: 'Unknown event' }, { status: 404 })
  try {
    const duration = event.end && event.end > event.start ? event.end - event.start + 2000 : 15000
    const clip = await downloadClip(event.deviceId, Math.max(event.start - 2000, 0), duration)
    const stamp = new Date(event.start).toISOString().replace(/[:.]/g, '-')
    return new Response(new Uint8Array(clip.bytes), {
      headers: {
        'Content-Type': clip.contentType,
        'Content-Disposition': `attachment; filename="ring-${stamp}.mp4"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Clip failed' }, { status: 502 })
  }
}
