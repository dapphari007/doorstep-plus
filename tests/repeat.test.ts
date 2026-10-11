import { describe, expect, it } from 'vitest'
import { sceneSignature } from '@/lib/pipeline'
import type { Perception } from '@/lib/perception/schema'

const base: Perception = {
  category: 'delivery',
  caption: 'Package on the step',
  details: 'A box sits on the step.',
  actors: [],
  package: { present: true, action: 'present' },
  vehicle: { present: false },
  urgency: 'low',
  confidence: 0.9,
  safetyNotes: [],
  model: 'test',
  latencyMs: 0,
}

describe('sceneSignature', () => {
  it('ignores wording changes', () => {
    expect(sceneSignature({ ...base, caption: 'Package on step in snow' })).toBe(sceneSignature(base))
  })
  it('changes when a person appears or the package moves', () => {
    expect(sceneSignature({ ...base, actors: [{ role: 'person', action: 'walking' }] })).not.toBe(sceneSignature(base))
    expect(sceneSignature({ ...base, package: { present: true, action: 'picked_up' } })).not.toBe(sceneSignature(base))
  })
  it('treats one bird and several birds as the same scene', () => {
    const bird: Perception['actors'][number] = { role: 'unclear', action: 'eating' }
    const birds: Perception = {
      ...base,
      category: 'animal',
      package: { present: false, action: 'none' },
      actors: [bird],
    }
    expect(sceneSignature({ ...birds, actors: [bird, bird] })).toBe(sceneSignature(birds))
  })
})
