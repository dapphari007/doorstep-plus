import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { processRingEvent } from '@/lib/pipeline'
import { parseRingWebhook, verifyRingSignature } from '@/lib/ring/webhook'
import { blockedInDemo } from '@/lib/demo'

export const runtime = 'nodejs'

const seen = new Set<string>()

// Real-device webhooks: verify the raw body, answer fast, process in the background.
export async function POST(req: NextRequest) {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  const raw = await req.text()
  const key = config.ring.webhookSigningKey
  if (!key) return NextResponse.json({ error: 'Webhook signing key not configured' }, { status: 503 })
  if (!verifyRingSignature(key, raw, req.headers.get('X-Signature'))) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  }

  const evt = parseRingWebhook(JSON.parse(raw))
  if (!evt) return NextResponse.json({ status: 'ignored' })
  if (evt.requestId) {
    if (seen.has(evt.requestId)) return NextResponse.json({ status: 'duplicate' })
    seen.add(evt.requestId)
    if (seen.size > 2000) seen.delete(seen.values().next().value!)
  }

  if ((evt.type === 'motion_detected' || evt.type === 'button_press') && evt.deviceId) {
    void processRingEvent({
      id: `${evt.deviceId}_${evt.type}_${evt.timestamp}`,
      deviceId: evt.deviceId,
      ringType: evt.type === 'button_press' ? 'ding' : 'motion',
      subType: evt.subType,
      start: evt.timestamp,
      source: 'webhook',
    }).catch((err) => console.warn('[webhook] processing failed:', err))
  }
  return NextResponse.json({ status: 'accepted' })
}
