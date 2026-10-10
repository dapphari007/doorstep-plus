import { describe, expect, it } from 'vitest'
import { applySafety, LOW_CONFIDENCE } from '@/lib/perception/safety'
import type { ModelPerception } from '@/lib/perception/schema'

const base: ModelPerception = {
  category: 'visitor',
  caption: 'A person walking to the door',
  details: 'A person walks up the path.',
  actors: [{ role: 'person', action: 'walking' }],
  package: { present: false, action: 'none' },
  vehicle: { present: false },
  urgency: 'normal',
  confidence: 0.9,
}

describe('applySafety', () => {
  it('leaves a clean description alone', () => {
    const out = applySafety(base)
    expect(out.caption).toBe(base.caption)
    expect(out.safetyNotes).toEqual([])
  })

  it('never calls a person an animal', () => {
    const out = applySafety({ ...base, caption: 'A black bear near the door', details: 'A dark animal on the porch.' })
    expect(out.caption).toBe('A person is at the door')
    expect(out.caption.toLowerCase()).not.toMatch(/bear|animal/)
    expect(out.safetyNotes).toContain('Replaced animal wording in a scene with people')
  })

  it('keeps animal wording when there are no people', () => {
    const out = applySafety({
      ...base,
      category: 'animal',
      caption: 'A cat on the doorstep',
      details: 'A cat sits by the mat.',
      actors: [],
    })
    expect(out.caption).toBe('A cat on the doorstep')
  })

  it('removes race and appearance descriptors', () => {
    const out = applySafety({ ...base, caption: 'A Black woman ringing the bell' })
    expect(out.caption).toBe('A woman ringing the bell')
    expect(out.safetyNotes).toContain('Removed an identity or appearance guess')
  })

  it('removes relationship and identity guesses', () => {
    const out = applySafety({ ...base, details: 'Your neighbor is waving.' })
    expect(out.details).toBe('a person is waving.')
  })

  it('strips licence-plate-like strings', () => {
    const out = applySafety({ ...base, category: 'vehicle', caption: 'Car 7ABC123 parked in driveway', actors: [] })
    expect(out.caption).not.toContain('7ABC123')
    expect(out.safetyNotes).toContain('Removed a license-plate-like string')
  })

  it('does not treat carrier names as plates', () => {
    const out = applySafety({ ...base, caption: 'UPS driver leaving a box', carrierGuess: 'UPS' })
    expect(out.caption).toBe('UPS driver leaving a box')
  })

  it('uses general wording when confidence is low', () => {
    const out = applySafety({
      ...base,
      confidence: LOW_CONFIDENCE - 0.1,
      actors: [{ role: 'delivery_person', action: 'standing' }],
      carrierGuess: 'FedEx',
    })
    expect(out.caption).toBe('Someone may be at the door')
    expect(out.actors[0].role).toBe('person')
    expect(out.carrierGuess).toBeUndefined()
  })

  it('does not mutate its input', () => {
    const input = { ...base, caption: 'A black bear', actors: [{ role: 'person' as const, action: 'x' }] }
    applySafety(input)
    expect(input.caption).toBe('A black bear')
  })
})

describe('applySafety wording', () => {
  it('drops "named X" guesses without leaving gaps', () => {
    const out = applySafety({ ...base, details: 'A man named Steve is at the door.' })
    expect(out.details).toBe('A man is at the door.')
  })
})
