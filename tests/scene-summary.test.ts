import { describe, expect, it } from 'vitest'
import { scrubText } from '@/lib/perception/safety'
import { fallbackSummary, sceneCaptions } from '@/lib/scenes/summary'
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
})
