// Simple in-memory limits for the public demo (one server instance).

export interface Limits {
  perKey: number
  perKeyWindowMs: number
  total: number
  totalWindowMs: number
}

export interface LimitResult {
  ok: boolean
  retryAfterSec?: number
  reason?: 'visitor' | 'everyone'
}

export function createLimiter(limits: Limits) {
  const byKey = new Map<string, number[]>()
  let all: number[] = []

  return function check(key: string, now = Date.now()): LimitResult {
    const mine = (byKey.get(key) ?? []).filter((t) => t > now - limits.perKeyWindowMs)
    all = all.filter((t) => t > now - limits.totalWindowMs)

    if (all.length >= limits.total) {
      return { ok: false, reason: 'everyone', retryAfterSec: Math.ceil((all[0] + limits.totalWindowMs - now) / 1000) }
    }
    if (mine.length >= limits.perKey) {
      byKey.set(key, mine)
      return { ok: false, reason: 'visitor', retryAfterSec: Math.ceil((mine[0] + limits.perKeyWindowMs - now) / 1000) }
    }
    mine.push(now)
    all.push(now)
    byKey.set(key, mine)
    if (byKey.size > 10_000) byKey.clear()
    return { ok: true }
  }
}

/** First address in X-Forwarded-For (set by the load balancer), else a fixed key. */
export function clientKey(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
