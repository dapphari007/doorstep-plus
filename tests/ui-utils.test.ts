import { describe, expect, it } from 'vitest'
import { groupByDay, isVisible, shouldAlert } from '@/app/utils/feed'
import { errorMessage, relativeTime, secondsLeft } from '@/app/utils/format'
import { isAlertPrefs, isProfileId } from '@/app/utils/profiles'
import type { DoorEvent } from '@/lib/types'

const NOW = new Date('2026-10-11T15:00:00').getTime()

function ev(id: string, start: number, extra: Partial<DoorEvent> = {}): DoorEvent {
  return {
    id,
    deviceId: 'd',
    ringType: 'on_demand',
    start,
    source: 'live_frame',
    status: 'described',
    hasSnapshot: true,
    createdAt: start,
    perception: {
      category: 'delivery',
      caption: 'Package on the step',
      details: '',
      actors: [],
      package: { present: true, action: 'present' },
      vehicle: { present: false },
      urgency: 'low',
      confidence: 0.9,
      safetyNotes: [],
      model: 't',
      latencyMs: 0,
    },
    ...extra,
  }
}

describe('feed', () => {
  it('hides repeats and live-view sessions without media', () => {
    expect(isVisible(ev('a', NOW))).toBe(true)
    expect(isVisible(ev('b', NOW, { repeatOf: 'a' }))).toBe(false)
    expect(isVisible(ev('c', NOW, { source: 'history', status: 'no_media', perception: undefined }))).toBe(false)
    expect(isVisible(ev('d', NOW, { source: 'history', status: 'error', perception: undefined }))).toBe(false)
    expect(isVisible(ev('e', NOW, { ringType: 'ding', status: 'error', perception: undefined }))).toBe(true)
    const quiet = { ...ev('x', NOW).perception!, category: 'no_activity' as const }
    expect(isVisible(ev('f', NOW, { perception: quiet }))).toBe(false)
    expect(isVisible(ev('g', NOW, { source: 'history', ringType: 'motion', perception: quiet }))).toBe(true)
  })

  it('groups by day in order', () => {
    const groups = groupByDay([ev('a', NOW), ev('b', NOW - 3600_000), ev('c', NOW - 86_400_000)], NOW)
    expect(groups.map((g) => [g.day, g.events.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
    ])
  })

  it('alerts once, only for new, meaningful events', () => {
    const seen = new Set<string>()
    expect(shouldAlert(ev('a', NOW), NOW - 5000, seen)).toBe(true)
    seen.add('a')
    expect(shouldAlert(ev('a', NOW), NOW - 5000, seen)).toBe(false)
    expect(shouldAlert(ev('old', NOW - 60_000), NOW - 5000, seen)).toBe(false)
    expect(shouldAlert(ev('rep', NOW, { repeatOf: 'a' }), NOW - 5000, seen)).toBe(false)
    expect(shouldAlert(ev('pending', NOW, { status: 'pending' }), NOW - 5000, seen)).toBe(false)
  })
})

describe('format', () => {
  it('formats relative times', () => {
    expect(relativeTime(NOW - 10_000, NOW)).toBe('Just now')
    expect(relativeTime(NOW + 10_000, NOW)).toBe('Just now')
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5 min ago')
    expect(relativeTime(NOW - 86_400_000, NOW)).toMatch(/^Yesterday, /)
  })
  it('never counts down below zero', () => {
    expect(secondsLeft(NOW - 1000, NOW)).toBe(0)
    expect(secondsLeft(undefined, NOW)).toBe(0)
    expect(secondsLeft(NOW + 1500, NOW)).toBe(2)
  })
  it('extracts error messages', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage({}, 'fallback')).toBe('fallback')
  })
})

describe('stored preferences', () => {
  it('rejects tampered values', () => {
    expect(isProfileId('deaf')).toBe(true)
    expect(isProfileId('admin')).toBe(false)
    expect(isAlertPrefs({ flash: true, vibrate: false, speak: true, chime: false })).toBe(true)
    expect(isAlertPrefs({ flash: 'yes' })).toBe(false)
  })
})

describe('activity filters', () => {
  it('groups events by what happened', async () => {
    const { matchesFilter } = await import('@/app/utils/feed')
    const parcel = ev('p', NOW)
    const visitor = ev('v', NOW, {
      perception: {
        ...ev('x', NOW).perception!,
        category: 'visitor',
        package: { present: false, action: 'none' },
        actors: [{ role: 'person', action: 'waiting' }],
      },
    })
    const car = ev('c', NOW, {
      perception: {
        ...ev('x', NOW).perception!,
        category: 'vehicle',
        package: { present: false, action: 'none' },
        vehicle: { present: true, kind: 'car' },
      },
    })
    const ding = ev('d', NOW, { ringType: 'ding', perception: undefined, status: 'no_media' })
    const expected = ev('e', NOW, { expectationId: 'x1' })
    expect(matchesFilter(parcel, 'deliveries')).toBe(true)
    expect(matchesFilter(visitor, 'deliveries')).toBe(false)
    expect(matchesFilter(visitor, 'people')).toBe(true)
    expect(matchesFilter(car, 'vehicles')).toBe(true)
    expect(matchesFilter(car, 'people')).toBe(false)
    expect(matchesFilter(ding, 'doorbell')).toBe(true)
    expect(matchesFilter(expected, 'expected')).toBe(true)
    expect(matchesFilter(car, 'all')).toBe(true)
  })

  it('labels expected windows', async () => {
    const { windowLabel } = await import('@/app/utils/format')
    expect(windowLabel(NOW, NOW + 3600_000, NOW)).toMatch(/–/)
    expect(windowLabel(NOW - 3600_000, NOW + 14 * 3600_000, NOW)).toBe('Any time today')
  })
})
