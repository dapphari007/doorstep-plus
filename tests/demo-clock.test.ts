import { describe, expect, it } from 'vitest'
import { agentNow } from '@/lib/agent/ask'

describe('Ask clock in the read-only demo', () => {
  const recorded = Date.UTC(2026, 9, 11, 14, 0)
  const weeksLater = Date.UTC(2026, 10, 12, 9, 0)

  it('treats "now" as just after the last recorded event, so "today" still finds it', () => {
    expect(agentNow(recorded, true, weeksLater)).toBe(recorded + 30 * 60_000)
  })

  it('uses the real clock in the normal app and when nothing is recorded', () => {
    expect(agentNow(recorded, false, weeksLater)).toBe(weeksLater)
    expect(agentNow(undefined, true, weeksLater)).toBe(weeksLater)
  })
})
