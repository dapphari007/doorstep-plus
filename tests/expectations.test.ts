import { describe, expect, it } from 'vitest'
import { alertKindForEvent, spokenText } from '@/lib/alerts'
import {
  GRACE_MS,
  effectiveStatus,
  expectationPhrase,
  localTimeToEpoch,
  matchExpectation,
  validateWindow,
} from '@/lib/expectations/match'
import type { Perception } from '@/lib/perception/schema'
import type { DoorEvent, Expectation } from '@/lib/types'
import { shouldAlert } from '@/app/utils/feed'

const T = Date.UTC(2026, 9, 11, 9, 30) // 3:00 PM in India
const HOUR = 3600_000

const person: Perception = {
  category: 'visitor',
  caption: 'A person with a tool bag at the door',
  details: '',
  actors: [{ role: 'person', action: 'standing at the door' }],
  atDoor: true,
  package: { present: false, action: 'none' },
  vehicle: { present: false },
  urgency: 'normal',
  confidence: 0.9,
  safetyNotes: [],
  model: 't',
  latencyMs: 0,
}
const box: Perception = {
  ...person,
  category: 'delivery',
  actors: [],
  caption: 'Box on the step',
  package: { present: true, action: 'present' },
}

function ev(start: number, perception?: Perception, extra: Partial<DoorEvent> = {}): DoorEvent {
  return {
    id: `e${start}`,
    deviceId: 'd',
    ringType: 'motion',
    start,
    source: 'history',
    status: 'described',
    hasSnapshot: false,
    perception,
    createdAt: start,
    ...extra,
  }
}
function exp(
  kind: Expectation['kind'],
  label: string,
  from: number,
  until: number,
  extra: Partial<Expectation> = {},
): Expectation {
  return { id: `x-${label}`, kind, label, from, until, status: 'waiting', createdAt: from, ...extra }
}

describe('matchExpectation', () => {
  const plumber = exp('visitor', 'Plumber', T, T + HOUR)
  const parcel = exp('parcel', 'Amazon parcel', T - 6 * HOUR, T + 6 * HOUR)

  it('matches a person inside the window', () => {
    expect(matchExpectation(ev(T + 5 * 60_000, person), [plumber])?.id).toBe(plumber.id)
  })

  it('allows the grace period on both sides, but not beyond', () => {
    expect(matchExpectation(ev(T - GRACE_MS + 1000, person), [plumber])).toBeDefined()
    expect(matchExpectation(ev(T + HOUR + GRACE_MS - 1000, person), [plumber])).toBeDefined()
    expect(matchExpectation(ev(T - GRACE_MS - 1000, person), [plumber])).toBeUndefined()
  })

  it('matches parcels only on a visible package, and visitors only on a person', () => {
    expect(matchExpectation(ev(T, box), [plumber])).toBeUndefined()
    expect(matchExpectation(ev(T, box), [parcel])?.id).toBe(parcel.id)
    expect(matchExpectation(ev(T, person), [parcel])).toBeUndefined()
  })

  it('never matches someone only passing by, repeats, or finished expectations', () => {
    expect(matchExpectation(ev(T, { ...person, atDoor: false }), [plumber])).toBeUndefined()
    expect(matchExpectation(ev(T, person, { repeatOf: 'x' }), [plumber])).toBeUndefined()
    expect(matchExpectation(ev(T, person), [{ ...plumber, status: 'arrived' }])).toBeUndefined()
    expect(matchExpectation(ev(T, person), [{ ...plumber, status: 'cancelled' }])).toBeUndefined()
  })

  it('matches a doorbell press even without a picture', () => {
    expect(matchExpectation(ev(T, undefined, { ringType: 'ding', status: 'no_media' }), [plumber])?.id).toBe(plumber.id)
  })

  it('picks the window closest to the arrival', () => {
    const electrician = exp('visitor', 'Electrician', T + 3 * HOUR, T + 4 * HOUR)
    expect(matchExpectation(ev(T + 2.5 * HOUR, person), [plumber, electrician])?.id).toBe(electrician.id)
  })
})

describe('expectation helpers', () => {
  it('words matches without identifying anyone', () => {
    expect(expectationPhrase({ kind: 'visitor', label: 'Plumber' })).toBe('your plumber')
    expect(expectationPhrase({ kind: 'parcel', label: 'Amazon parcel' })).toBe('your Amazon parcel')
    expect(expectationPhrase({ kind: 'parcel', label: 'Parcel' })).toBe('your parcel')
    expect(expectationPhrase({ kind: 'visitor', label: 'Swiggy' })).toBe('your Swiggy')
    expect(expectationPhrase({ kind: 'household', label: 'Asha' })).toBe('Asha arriving home')
  })

  it('marks a waiting expectation missed after the grace period', () => {
    const x = exp('visitor', 'Plumber', T, T + HOUR)
    expect(effectiveStatus(x, T + HOUR + GRACE_MS - 1)).toBe('waiting')
    expect(effectiveStatus(x, T + HOUR + GRACE_MS + 1)).toBe('missed')
    expect(effectiveStatus({ ...x, status: 'arrived' }, T + 10 * HOUR)).toBe('arrived')
  })

  it('validates windows', () => {
    const now = Date.now()
    expect(validateWindow(now, now + HOUR)).toBeUndefined()
    expect(validateWindow(now + HOUR, now)).toMatch(/after/)
    expect(validateWindow(now, now + 4 * 24 * HOUR)).toMatch(/3 days/)
    expect(validateWindow(now - 5 * HOUR, now - 4 * HOUR)).toMatch(/over/)
    expect(validateWindow(NaN, now)).toMatch(/required/)
  })
})

describe('localTimeToEpoch', () => {
  it('converts India time (no daylight saving)', () => {
    expect(localTimeToEpoch('15:00', 0, 'Asia/Kolkata', T)).toBe(Date.UTC(2026, 9, 11, 9, 30))
    expect(localTimeToEpoch('09:00', 1, 'Asia/Kolkata', T)).toBe(Date.UTC(2026, 9, 12, 3, 30))
  })

  it('handles a US daylight-saving change', () => {
    // Clocks go back on 1 Nov 2026 in Los Angeles: 3 PM is UTC-8 after, UTC-7 before.
    const sat = Date.UTC(2026, 9, 31, 19, 0)
    expect(localTimeToEpoch('15:00', 0, 'America/Los_Angeles', sat)).toBe(Date.UTC(2026, 9, 31, 22, 0))
    expect(localTimeToEpoch('15:00', 1, 'America/Los_Angeles', sat)).toBe(Date.UTC(2026, 10, 1, 23, 0))
  })

  it('rejects bad times', () => {
    expect(() => localTimeToEpoch('25:00', 0, 'Asia/Kolkata', T)).toThrow()
    expect(() => localTimeToEpoch('3pm', 0, 'Asia/Kolkata', T)).toThrow()
  })
})

describe('doorbell and passing-by alerts', () => {
  it('a doorbell press is its own alert, even with no picture', () => {
    const ding = ev(T, undefined, { ringType: 'ding', status: 'no_media' })
    expect(alertKindForEvent(ding)).toBe('doorbell')
    expect(shouldAlert(ding, T - 1000, new Set())).toBe(true)
  })

  it('someone passing in the background is silent', () => {
    const passer = ev(T, { ...person, atDoor: false })
    expect(alertKindForEvent(passer)).toBe('passing')
    expect(shouldAlert(passer, T - 1000, new Set())).toBe(false)
  })

  it('says the expected match out loud', () => {
    const text = spokenText({ ...ev(T, person), expectationLabel: 'your plumber' }, 'Asia/Kolkata')
    expect(text).toBe('Someone at the door. A person with a tool bag at the door. Possibly your plumber. 3:00 PM.')
  })
})

describe('choosing between expectations', () => {
  const courier: Perception = {
    ...person,
    category: 'delivery',
    caption: 'Delivery driver leaving a box',
    actors: [{ role: 'delivery_person', action: 'placing a box' }],
    package: { present: true, action: 'dropped_off' },
  }
  const plumber = exp('visitor', 'Plumber', T, T + HOUR)
  const parcel = exp('parcel', 'Amazon parcel', T - 6 * HOUR, T + 6 * HOUR)

  it('a courier with a box is the expected parcel, not the expected plumber', () => {
    expect(matchExpectation(ev(T + 10 * 60_000, courier), [plumber, parcel])?.id).toBe(parcel.id)
  })

  it('a courier still counts as a visitor when no parcel is expected', () => {
    expect(matchExpectation(ev(T, courier), [plumber])?.id).toBe(plumber.id)
  })

  it('a non-courier at the door prefers the visitor over a parcel window', () => {
    expect(matchExpectation(ev(T, person), [parcel, plumber])?.id).toBe(plumber.id)
  })
})
