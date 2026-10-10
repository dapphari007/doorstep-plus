import { describe, expect, it } from 'vitest'
import { clientKey, createLimiter } from '@/lib/rate-limit'

describe('demo rate limits', () => {
  const limits = { perKey: 2, perKeyWindowMs: 1000, total: 3, totalWindowMs: 10_000 }

  it('limits each visitor within the window, then lets them back in', () => {
    const check = createLimiter(limits)
    expect(check('a', 0).ok).toBe(true)
    expect(check('a', 1).ok).toBe(true)
    const third = check('a', 2)
    expect(third).toMatchObject({ ok: false, reason: 'visitor' })
    expect(third.retryAfterSec).toBe(1)
    expect(check('a', 1001).ok).toBe(true)
  })

  it('caps everyone together', () => {
    const check = createLimiter(limits)
    expect(check('a', 0).ok).toBe(true)
    expect(check('b', 0).ok).toBe(true)
    expect(check('c', 0).ok).toBe(true)
    expect(check('d', 0)).toMatchObject({ ok: false, reason: 'everyone' })
  })

  it('reads the first forwarded address', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5')
    expect(clientKey(new Headers())).toBe('unknown')
  })
})
