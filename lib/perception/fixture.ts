// Canned descriptions for FIXTURE_MODE.

import type { ModelPerception } from './schema'

const SCENES: Record<string, ModelPerception> = {
  package: {
    category: 'delivery',
    caption: 'Delivery driver leaving a box on the doorstep',
    details:
      'A person in a delivery uniform places a medium cardboard box beside the door, then walks back toward the street.',
    actors: [{ role: 'delivery_person', action: 'placing a box on the step' }],
    package: { present: true, action: 'dropped_off' },
    vehicle: { present: true, kind: 'delivery van' },
    carrierGuess: 'Amazon',
    urgency: 'normal',
    confidence: 0.9,
  },
  vehicle: {
    category: 'vehicle',
    caption: 'A car pulled into the driveway',
    details: 'A dark sedan stops in the driveway with its headlights on. Nobody has got out yet.',
    actors: [],
    package: { present: false, action: 'none' },
    vehicle: { present: true, kind: 'car' },
    urgency: 'low',
    confidence: 0.85,
  },
  motion: {
    category: 'visitor',
    caption: 'Someone is walking up to the front door',
    details: 'A person carrying a bag walks along the path toward the door and looks at the doorbell.',
    actors: [{ role: 'person', action: 'walking to the door' }],
    package: { present: false, action: 'none' },
    vehicle: { present: false },
    urgency: 'normal',
    confidence: 0.8,
  },
  pickup: {
    category: 'visitor',
    caption: 'A person picked up the package from the step',
    details: 'A person bends down, lifts the box from beside the door and walks away toward the sidewalk.',
    actors: [{ role: 'person', action: 'carrying the box away' }],
    package: { present: true, action: 'picked_up' },
    vehicle: { present: false },
    urgency: 'normal',
    confidence: 0.82,
  },
}

export const FIXTURE_SCENES = Object.keys(SCENES)

export function fixturePerception(scene?: string): ModelPerception {
  const key = (scene || '').toLowerCase()
  const match =
    SCENES[key] || (key.includes('package') ? SCENES.package : key.includes('vehicle') ? SCENES.vehicle : SCENES.motion)
  return structuredClone(match)
}
