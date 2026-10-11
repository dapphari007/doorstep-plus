import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { processRingEvent } from '@/lib/pipeline'
import { publish } from '@/lib/bus'
import { listDevices, motionDetectionOn } from '@/lib/ring/client'
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

  const motionOff = evt.type === 'motion_detected' && evt.deviceId && !(await motionDetectionOn(evt.deviceId))
  if ((evt.type === 'motion_detected' || evt.type === 'button_press') && evt.deviceId && !motionOff) {
    void processRingEvent({
      id: `${evt.deviceId}_${evt.type}_${evt.timestamp}`,
      deviceId: evt.deviceId,
      ringType: evt.type === 'button_press' ? 'ding' : 'motion',
      subType: evt.subType,
      componentId: evt.componentIds?.[0],
      start: evt.timestamp,
      source: 'webhook',
    }).catch((err) => console.warn('[webhook] processing failed:', err))
  }
  if ((evt.type === 'device_online' || evt.type === 'device_offline') && evt.deviceId) {
    const devices = await listDevices().catch(() => [])
    publish({
      kind: 'camera',
      camera: {
        deviceId: evt.deviceId,
        name: devices.find((d) => d.id === evt.deviceId)?.name ?? 'Your camera',
        online: evt.type === 'device_online',
        at: evt.timestamp,
      },
    })
  }
  return NextResponse.json({ status: 'accepted' })
}
