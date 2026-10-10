import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelPerception } from '@/lib/perception/schema'
import type { DoorEvent } from '@/lib/types'

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'doorstep-test-'))

const drop: ModelPerception = {
  category: 'delivery',
  caption: 'Delivery driver leaving a box',
  details: 'A courier places a box by the door.',
  actors: [{ role: 'delivery_person', action: 'placing a box' }],
  package: { present: true, action: 'dropped_off' },
  vehicle: { present: true, kind: 'van' },
  urgency: 'normal',
  confidence: 0.9,
}

function event(id: string, start: number, p: ModelPerception): DoorEvent {
  return {
    id,
    deviceId: 'dev',
    ringType: 'on_demand',
    start,
    source: 'history',
    status: 'described',
    hasSnapshot: false,
    perception: { ...p, safetyNotes: [], model: 'test', latencyMs: 0 },
    createdAt: start,
  }
}

describe('delivery flow', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(globalThis as any).__doorstepStore = undefined
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'doorstep-test-'))
  })

  it('verifies a clear drop-off and opens the simulated box with a 6-digit code', async () => {
    const { handleDeliveryLogic } = await import('@/lib/delivery/flow')
    const { getLock } = await import('@/lib/delivery/lock')
    const now = Date.now()
    const d = await handleDeliveryLogic(event('e1', now, drop))
    expect(d?.status).toBe('verified')
    expect(d?.code).toMatch(/^\d{6}$/)
    const lock = await getLock(now + 1000)
    expect(lock.simulated).toBe(true)
    expect(lock.locked).toBe(false)
    expect(lock.activeCode?.code).toBe(d?.code)
    // Auto re-lock after the window.
    const later = await getLock(now + 3 * 60_000)
    expect(later.locked).toBe(true)
  })

  it('does not open the box when the courier is unclear', async () => {
    const { handleDeliveryLogic } = await import('@/lib/delivery/flow')
    const d = await handleDeliveryLogic(
      event('e2', Date.now(), { ...drop, actors: [{ role: 'person', action: 'leaving something' }] }),
    )
    expect(d?.status).toBe('needs_review')
    expect(d?.code).toBeUndefined()
  })

  it('marks the delivery taken when a later event shows a pickup', async () => {
    const { handleDeliveryLogic } = await import('@/lib/delivery/flow')
    const t = Date.now()
    await handleDeliveryLogic(event('e3', t, drop))
    const taken = await handleDeliveryLogic(
      event('e4', t + 60_000, {
        ...drop,
        category: 'visitor',
        actors: [{ role: 'person', action: 'carrying the box away' }],
        package: { present: true, action: 'picked_up' },
      }),
    )
    expect(taken?.status).toBe('taken')
    expect(taken?.takenEventId).toBe('e4')
  })

  it('rejects a wrong code', async () => {
    const { manualAction } = await import('@/lib/delivery/lock')
    await expect(manualAction('unlock', '000000')).rejects.toThrow('Wrong or expired code')
  })
})

describe('package already at the door', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(globalThis as any).__doorstepStore = undefined
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'doorstep-test-'))
  })

  const sitting: ModelPerception = {
    ...drop,
    caption: 'Package on the step',
    actors: [],
    package: { present: true, action: 'present' },
  }

  it('tracks it without opening the box, once, and flags a later pickup', async () => {
    const { handleDeliveryLogic } = await import('@/lib/delivery/flow')
    const { getLock } = await import('@/lib/delivery/lock')
    const t = Date.now()
    const spotted = await handleDeliveryLogic(event('s1', t, sitting))
    expect(spotted?.status).toBe('needs_review')
    expect(spotted?.code).toBeUndefined()
    expect((await getLock(t)).locked).toBe(true)
    // Seeing the same package again does not create a second record.
    expect(await handleDeliveryLogic(event('s2', t + 10_000, sitting))).toBeUndefined()
    const taken = await handleDeliveryLogic(
      event('s3', t + 20_000, {
        ...sitting,
        actors: [{ role: 'person', action: 'carrying the box away' }],
        package: { present: true, action: 'picked_up' },
      }),
    )
    expect(taken?.status).toBe('taken')
    expect(taken?.id).toBe(spotted?.id)
  })
})
