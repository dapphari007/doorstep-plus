import { createHmac } from 'crypto'
import { describe, expect, it } from 'vitest'
import { parseRingWebhook, verifyRingSignature } from '@/lib/ring/webhook'

const key = 'test-signing-key'
const body = JSON.stringify({
  meta: { version: '1.1', time: '2026-10-10T10:00:00Z', request_id: 'req-1', account_id: 'acct' },
  data: {
    id: 'dev_motion_1',
    type: 'motion_detected',
    attributes: { source: 'dev', source_type: 'devices', timestamp: 1786715596787, sub_type: 'package_delivery' },
  },
})
const sig = 'sha256=' + createHmac('sha256', key).update(body).digest('hex')

describe('verifyRingSignature', () => {
  it('accepts a valid signature over the raw body', () => {
    expect(verifyRingSignature(key, body, sig)).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(verifyRingSignature(key, body.replace('package_delivery', 'human'), sig)).toBe(false)
  })
  it('rejects re-serialised JSON with different whitespace', () => {
    expect(verifyRingSignature(key, JSON.stringify(JSON.parse(body), null, 2), sig)).toBe(false)
  })
  it('rejects a missing or malformed header', () => {
    expect(verifyRingSignature(key, body, null)).toBe(false)
    expect(verifyRingSignature(key, body, 'sha256=nothex')).toBe(false)
  })
})

describe('parseRingWebhook', () => {
  it('reads sub_type from attributes', () => {
    expect(parseRingWebhook(JSON.parse(body))).toEqual({
      requestId: 'req-1',
      type: 'motion_detected',
      subType: 'package_delivery',
      deviceId: 'dev',
      timestamp: 1786715596787,
    })
  })
  it('ignores payloads without data.type', () => {
    expect(parseRingWebhook({ meta: {} })).toBeNull()
  })
})
