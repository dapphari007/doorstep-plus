import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { processLiveFrame } from '@/lib/pipeline'
import { resolveDeviceId } from '@/lib/ring/client'

export const runtime = 'nodejs'

const MAX_BYTES = 4 * 1024 * 1024

/** Describe a frame captured from the live Ring stream in the browser. */
export async function POST(req: NextRequest) {
  try {
    const { image, hint, deviceId } = await req.json()
    const match = typeof image === 'string' ? /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(image) : null
    if (!match && !config.fixtures) {
      return NextResponse.json({ error: 'Send image as a JPEG or PNG data URL' }, { status: 400 })
    }
    const bytes = match ? Buffer.from(match[2], 'base64') : Buffer.alloc(0)
    if (bytes.length > MAX_BYTES) return NextResponse.json({ error: 'Image too large' }, { status: 413 })
    const event = await processLiveFrame({
      deviceId: deviceId || (config.fixtures ? 'fixture-device' : await resolveDeviceId()),
      image: bytes,
      mediaType: (match?.[1] as 'image/jpeg' | 'image/png') || 'image/jpeg',
      hint: typeof hint === 'string' ? hint.slice(0, 40) : undefined,
    })
    return NextResponse.json({ event })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Describe failed' }, { status: 500 })
  }
}
