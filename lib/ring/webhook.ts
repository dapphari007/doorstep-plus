import { createHmac, timingSafeEqual } from 'crypto'

// X-Signature is "sha256=" + hex HMAC of the raw body.
export function verifyRingSignature(signingKey: string, rawBody: string | Buffer, header: string | null): boolean {
  if (!header) return false
  const received = header.startsWith('sha256=') ? header.slice(7) : header
  const expected = createHmac('sha256', signingKey).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(received, 'hex')
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}

export interface RingWebhookEvent {
  requestId?: string
  type: string
  subType?: string
  deviceId?: string
  timestamp: number
}

/** Pull the fields we act on from a v1.1 webhook payload. */
export function parseRingWebhook(body: any): RingWebhookEvent | null {
  const data = body?.data
  if (!data?.type) return null
  const attrs = data.attributes || {}
  const ts = typeof attrs.timestamp === 'number' ? attrs.timestamp : Date.parse(attrs.timestamp ?? body?.meta?.time)
  return {
    requestId: body?.meta?.request_id,
    type: data.type,
    subType: attrs.sub_type,
    deviceId: attrs.source,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
  }
}
