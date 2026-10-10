import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { processLiveFrame } from '@/lib/pipeline'
import { resolveDeviceId } from '@/lib/ring/client'
import { blockedInDemo } from '@/lib/demo'

export const runtime = 'nodejs'

const MAX_FRAMES = 3
const MAX_FRAME_BYTES = 4 * 1024 * 1024
const MAX_TOTAL_BYTES = 9 * 1024 * 1024

type MediaType = 'image/jpeg' | 'image/png'

function decode(dataUrl: unknown): { bytes: Buffer; mediaType: MediaType } | undefined {
  const match = typeof dataUrl === 'string' ? /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUrl) : null
  return match ? { bytes: Buffer.from(match[2], 'base64'), mediaType: match[1] as MediaType } : undefined
}

/**
 * Describe what the live view shows. Send `images` (up to 3 data URLs, oldest first,
 * about a second apart) so movement can be described, or a single `image`.
 */
export async function POST(req: NextRequest) {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  try {
    const { image, images, hint, deviceId } = await req.json()
    const raw: unknown[] = Array.isArray(images) ? images : image ? [image] : []
    if (raw.length > MAX_FRAMES)
      return NextResponse.json({ error: `Send at most ${MAX_FRAMES} frames` }, { status: 400 })

    const frames = raw.map(decode)
    if (frames.some((f) => !f) || (!frames.length && !config.fixtures)) {
      return NextResponse.json({ error: 'Send JPEG or PNG data URLs' }, { status: 400 })
    }
    const ok = frames as { bytes: Buffer; mediaType: MediaType }[]
    if (
      ok.some((f) => f.bytes.length > MAX_FRAME_BYTES) ||
      ok.reduce((n, f) => n + f.bytes.length, 0) > MAX_TOTAL_BYTES
    ) {
      return NextResponse.json({ error: 'Images too large' }, { status: 413 })
    }

    const latest = ok[ok.length - 1]
    const event = await processLiveFrame({
      deviceId: deviceId || (config.fixtures ? 'fixture-device' : await resolveDeviceId()),
      image: latest?.bytes ?? Buffer.alloc(0),
      earlier: ok.slice(0, -1).map((f) => f.bytes),
      mediaType: latest?.mediaType ?? 'image/jpeg',
      hint: typeof hint === 'string' ? hint.slice(0, 40) : undefined,
    })
    return NextResponse.json({ event })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Describe failed' }, { status: 500 })
  }
}
