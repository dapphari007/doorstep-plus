import { describe, expect, it } from 'vitest'
import { scrubText } from '@/lib/perception/safety'
import { fallbackSummary, needsSummary, sceneCaptions } from '@/lib/scenes/summary'
import type { Perception } from '@/lib/perception/schema'
import type { DoorEvent } from '@/lib/types'

describe('scene summary', () => {
  it('reads the whole scene in order', () => {
    const e = {
      perception: { caption: 'Car crossing the parking lot' },
      updates: [{ at: 2, caption: 'Car crossing your driveway' }],
    } as DoorEvent
    expect(sceneCaptions(e)).toEqual(['Car crossing the parking lot', 'Car crossing your driveway'])
    expect(fallbackSummary(sceneCaptions(e))).toBe('Car crossing the parking lot, then car crossing your driveway')
  })

  it('goes through the same identity clean-up as captions', () => {
    expect(scrubText('Your neighbour drove past in 7ABC123')).toBe('a person drove past in [vehicle]')
  })

  it('gives one final word to quiet scenes, and only to alerting scenes that changed', () => {
    const p = (over: Partial<Perception>) =>
      ({
        category: 'vehicle',
        caption: 'Car driving past',
        actors: [],
        package: { present: false, action: 'none' },
        vehicle: { present: true },
        motion: 'passing',
        ...over,
      }) as Perception
    const event = (perception: Perception, updates?: DoorEvent['updates']) =>
      ({ ringType: 'on_demand', perception, updates }) as DoorEvent
    expect(needsSummary(event(p({})))).toBe(true)
    expect(needsSummary(event(p({ category: 'animal', motion: 'staying' })))).toBe(false)
    expect(needsSummary(event(p({ category: 'animal', motion: 'staying' }), [{ at: 1, caption: 'x' }]))).toBe(true)
    expect(needsSummary(event(p({ category: 'no_activity', vehicle: { present: false } })))).toBe(false)
  })
})
