import { describe, expect, it } from 'vitest'
import { alertKindForEvent } from '@/lib/alerts'
import type { Perception } from '@/lib/perception/schema'
import { sameScene, sceneSignature } from '@/lib/pipeline'
import { CHANGE_THRESHOLD, frameDifference, hasChanged } from '@/app/utils/frames'

const car: Perception = {
  category: 'vehicle',
  caption: 'A car drives through the parking lot',
  details: '',
  actors: [],
  package: { present: false, action: 'none' },
  vehicle: { present: true, kind: 'car' },
  motion: 'passing',
  urgency: 'low',
  confidence: 0.9,
  safetyNotes: [],
  model: 't',
  latencyMs: 0,
}
const event = (p: Perception) => ({ ringType: 'on_demand', perception: p })

describe('movement', () => {
  it('a car or person just passing by does not alert', () => {
    expect(alertKindForEvent(event(car))).toBe('passing')
    expect(
      alertKindForEvent(
        event({
          ...car,
          category: 'visitor',
          vehicle: { present: false },
          actors: [{ role: 'person', action: 'walking past' }],
        }),
      ),
    ).toBe('passing')
  })

  it('a car arriving or someone leaving still alerts', () => {
    expect(alertKindForEvent(event({ ...car, motion: 'arriving' }))).toBe('vehicle')
    expect(
      alertKindForEvent(
        event({ ...car, category: 'visitor', motion: 'leaving', actors: [{ role: 'person', action: 'walking away' }] }),
      ),
    ).toBe('visitor')
  })

  it('a package is never silenced by movement', () => {
    expect(
      alertKindForEvent(event({ ...car, category: 'delivery', package: { present: true, action: 'dropped_off' } })),
    ).toBe('delivery')
  })

  it('treats a change in movement as a new scene', () => {
    expect(sceneSignature({ ...car, motion: 'arriving' })).not.toBe(sceneSignature({ ...car, motion: 'staying' }))
    expect(sceneSignature(car)).toBe(sceneSignature({ ...car, caption: 'Car passing through the lot' }))
  })
})

describe('change detection', () => {
  const flat = (v: number) => new Uint8Array(32 * 18).fill(v)

  it('measures how different two thumbnails are', () => {
    expect(frameDifference(flat(100), flat(100))).toBe(0)
    expect(frameDifference(flat(100), flat(110))).toBe(10)
    expect(frameDifference(flat(1), new Uint8Array(3))).toBe(255)
  })

  it('skips unchanged scenes and catches real changes', () => {
    expect(hasChanged([flat(100), flat(101)], flat(100))).toBe(false)
    expect(hasChanged([flat(100), flat(100 + CHANGE_THRESHOLD)], flat(100))).toBe(true)
    expect(hasChanged([flat(100)], undefined)).toBe(true)
  })
})

describe('one car, one row', () => {
  it('keeps a car crossing the view as one scene while its motion changes', () => {
    expect(sameScene({ ...car, motion: 'arriving' }, { ...car, motion: 'passing' })).toBe(true)
  })
  it('splits when a person or package shows up', () => {
    expect(sameScene(car, { ...car, actors: [{ role: 'person', action: 'walking' }] })).toBe(false)
  })
})

describe('parked vehicles', () => {
  it('never alert, but a car arriving home does', () => {
    expect(alertKindForEvent(event({ ...car, motion: 'none' }))).toBe('parked')
    expect(alertKindForEvent(event({ ...car, motion: 'staying' }))).toBe('parked')
    expect(alertKindForEvent(event({ ...car, motion: 'arriving' }))).toBe('vehicle')
  })
})
