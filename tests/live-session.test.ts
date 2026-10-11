import { beforeEach, describe, expect, it, vi } from 'vitest'
import { liveSessionFrame } from '@/lib/pipeline'
import type { DoorEvent } from '@/lib/types'

let stored: DoorEvent[] = []
vi.mock('@/lib/store', () => ({
  getStore: () => ({
    listEvents: async ({ since, until }: { since: number; until: number }) =>
      stored.filter((e) => e.start >= since && e.start <= until).sort((a, b) => b.start - a.start),
  }),
}))

const frame = (id: string, start: number, caption: string): DoorEvent => ({
  id,
  deviceId: 'd',
  ringType: 'on_demand',
  start,
  source: 'live_frame',
  status: 'described',
  hasSnapshot: true,
  createdAt: start,
  perception: { caption } as DoorEvent['perception'],
})

const session = {
  id: 'h1',
  deviceId: 'd',
  ringType: 'on_demand',
  start: 1_000_000,
  end: 1_060_000,
  source: 'history' as const,
}

describe('live view sessions in Ring history', () => {
  beforeEach(() => (stored = []))

  it('merges into the latest frame we described during the session', async () => {
    stored = [frame('a', 1_010_000, 'bird'), frame('b', 1_040_000, 'bird again')]
    expect((await liveSessionFrame(session))?.id).toBe('b')
  })

  it('ignores frames from another session', async () => {
    stored = [frame('a', 1_200_000, 'car')]
    expect(await liveSessionFrame(session)).toBeUndefined()
  })

  it('leaves motion and doorbell events alone', async () => {
    stored = [frame('a', 1_010_000, 'bird')]
    expect(await liveSessionFrame({ ...session, ringType: 'motion' })).toBeUndefined()
  })
})
