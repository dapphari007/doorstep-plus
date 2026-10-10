// Deterministic clean-up of model output: what is happening, never who.

import type { ModelPerception } from './schema'

const ANIMAL_WORDS = [
  'animal', 'bear', 'ape', 'monkey', 'gorilla', 'dog', 'cat', 'creature', 'beast', 'raccoon', 'deer', 'coyote', 'fox',
]
const IDENTITY_RULES: { re: RegExp; replace: (match: string, ...groups: string[]) => string }[] = [
  // Race, ethnicity and skin-tone descriptors: keep the noun, drop the descriptor.
  {
    re: /\b(black|white|brown|asian|hispanic|latino|latina|latinx|african|caucasian|indian|arab|dark[- ]skinned|light[- ]skinned|pale[- ]skinned)\s+(man|woman|person|people|guy|lady|boy|girl|male|female|individual|child|kid|teen)\b/gi,
    replace: (_m, _descriptor, noun) => noun,
  },
  // Guesses about a person's identity or relationship to the resident.
  {
    re: /\b(your|the)\s+(neighbou?r|mailman|husband|wife|son|daughter|mom|dad|mother|father|landlord|roommate)\b/gi,
    replace: () => 'a person',
  },
  { re: /\s*\b(who looks like|resembles|appears to be named|named)\s+[A-Z][a-z]+/g, replace: () => '' },
]
// Plate-like strings: 2-4 letters/digits, optional separator, 3-4 more.
const PLATE_PATTERN = /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,4}[- ]?[A-Z0-9]{3,4}\b/g

export const LOW_CONFIDENCE = 0.45

function scrub(text: string, notes: Set<string>): string {
  let out = text
  for (const { re, replace } of IDENTITY_RULES) {
    out = out.replace(re, (...args: string[]) => {
      notes.add('Removed an identity or appearance guess')
      return replace(...(args as [string, ...string[]]))
    })
  }
  out = out.replace(PLATE_PATTERN, () => {
    notes.add('Removed a license-plate-like string')
    return '[vehicle]'
  })
  return out.replace(/\s{2,}/g, ' ').trim()
}

function mentionsAnimal(text: string): boolean {
  const lower = text.toLowerCase()
  return ANIMAL_WORDS.some((w) => new RegExp(`\\b${w}s?\\b`).test(lower))
}

export function applySafety(p: ModelPerception): ModelPerception & { safetyNotes: string[] } {
  const notes = new Set<string>()
  const out: ModelPerception = {
    ...p,
    actors: p.actors.map((a) => ({ ...a })),
    package: { ...p.package },
    vehicle: { ...p.vehicle },
  }

  out.caption = scrub(out.caption, notes)
  out.details = scrub(out.details, notes)
  out.actors = out.actors.map((a) => ({ ...a, action: scrub(a.action, notes) }))
  if (out.carrierGuess) out.carrierGuess = scrub(out.carrierGuess, notes)

  // People are never described as animals.
  const hasPeople = out.actors.some((a) => a.role !== 'unclear') || out.category === 'visitor' || out.category === 'delivery'
  if (hasPeople && (mentionsAnimal(out.caption) || mentionsAnimal(out.details))) {
    notes.add('Replaced animal wording in a scene with people')
    out.caption = neutralCaption(out)
    out.details = 'A person is at the door.'
    if (out.category === 'animal') out.category = 'visitor'
  }

  // Ambiguous scenes (night, glare, watermark) get honest, generic wording.
  if (out.confidence < LOW_CONFIDENCE && out.category !== 'no_activity') {
    notes.add('Low confidence: using general wording')
    out.caption = hasPeople ? 'Someone may be at the door' : 'Movement near the door'
    out.actors = out.actors.map((a) => ({ ...a, role: a.role === 'delivery_person' ? 'person' : a.role }))
    out.carrierGuess = undefined
  }

  return { ...out, safetyNotes: Array.from(notes) }
}

function neutralCaption(p: ModelPerception): string {
  if (p.package.action === 'dropped_off') return 'A person left a package at the door'
  if (p.package.action === 'picked_up') return 'A person picked up a package'
  return 'A person is at the door'
}
