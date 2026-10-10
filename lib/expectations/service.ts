import { randomUUID } from 'crypto'
import { publish } from '../bus'
import { getStore } from '../store'
import type { DoorEvent, Expectation } from '../types'
import { HOUSEHOLD_WINDOW_MS, effectiveStatus, expectationPhrase, matchExpectation, validateWindow } from './match'

export class ExpectationError extends Error {}

const MAX_LABEL = 40

export async function createExpectation(input: {
  kind: Expectation['kind']
  label: string
  from?: number
  until?: number
}): Promise<Expectation> {
  const label = (input.label ?? '').trim().replace(/\s+/g, ' ')
  if (!label) throw new ExpectationError('Say who or what you are expecting')
  if (label.length > MAX_LABEL) throw new ExpectationError(`Keep the name under ${MAX_LABEL} characters`)
  if (!['visitor', 'parcel', 'household'].includes(input.kind)) throw new ExpectationError('Unknown kind')

  const now = Date.now()
  const from = input.kind === 'household' ? now : Number(input.from)
  const until = input.kind === 'household' ? now + HOUSEHOLD_WINDOW_MS : Number(input.until)
  const problem = validateWindow(from, until)
  if (problem) throw new ExpectationError(problem)

  const expectation: Expectation = {
    id: `exp_${randomUUID()}`,
    kind: input.kind,
    label,
    from,
    until,
    status: 'waiting',
    createdAt: now,
  }
  await getStore().putExpectation(expectation)
  publish({ kind: 'expectation', expectation })
  return expectation
}

export async function cancelExpectation(id: string): Promise<Expectation> {
  const store = getStore()
  const x = await store.getExpectation(id)
  if (!x) throw new ExpectationError('Not found')
  if (x.status !== 'waiting') return x
  const cancelled: Expectation = { ...x, status: 'cancelled' }
  await store.putExpectation(cancelled)
  publish({ kind: 'expectation', expectation: cancelled })
  return cancelled
}

export async function listExpectations(limit = 50) {
  const now = Date.now()
  return (await getStore().listExpectations(limit)).map((x) => ({ ...x, effectiveStatus: effectiveStatus(x, now) }))
}

/** Link an event to the expectation it most likely is, and mark that expectation arrived. */
export async function applyExpectations(event: DoorEvent): Promise<Expectation | undefined> {
  const store = getStore()
  const waiting = (await store.listExpectations(100)).filter((x) => x.status === 'waiting')
  const match = matchExpectation(event, waiting)
  if (!match) return undefined
  const arrived: Expectation = { ...match, status: 'arrived', matchedEventId: event.id, matchedAt: event.start }
  await store.putExpectation(arrived)
  publish({ kind: 'expectation', expectation: arrived })
  event.expectationId = arrived.id
  event.expectationLabel = expectationPhrase(arrived)
  return arrived
}
