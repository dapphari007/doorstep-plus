// Simulated parcel box: the Ring API has no lock control.

import { randomInt } from 'crypto'
import { publish } from '../bus'
import { getStore } from '../store'
import type { LockState } from '../types'

export const UNLOCK_WINDOW_MS = 2 * 60_000
export const CODE_TTL_MS = 10 * 60_000

function fresh(): LockState {
  return { simulated: true, locked: true, log: [] }
}

/** Current state, applying the automatic re-lock and code expiry. */
export async function getLock(now = Date.now()): Promise<LockState> {
  const lock = (await getStore().getLock()) ?? fresh()
  let changed = false
  if (!lock.locked && lock.unlockedUntil && lock.unlockedUntil <= now) {
    lock.locked = true
    lock.unlockedUntil = undefined
    lock.log.unshift({ at: now, action: 'auto_lock', detail: 'Re-locked automatically after the delivery window' })
    changed = true
  }
  if (lock.activeCode && lock.activeCode.expiresAt <= now) {
    lock.log.unshift({ at: now, action: 'code_expired', detail: 'Delivery code expired unused' })
    lock.activeCode = undefined
    changed = true
  }
  if (changed) await save(lock)
  return lock
}

async function save(lock: LockState) {
  lock.log = lock.log.slice(0, 50)
  await getStore().putLock(lock)
  publish({ kind: 'lock', lock })
}

/** Issue a one-time code and open the box for the courier's drop-off window. */
export async function issueDeliveryCode(deliveryId: string, now = Date.now()) {
  const lock = await getLock(now)
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  lock.activeCode = { code, expiresAt: now + CODE_TTL_MS, deliveryId }
  lock.locked = false
  lock.unlockedUntil = now + UNLOCK_WINDOW_MS
  lock.log.unshift({
    at: now,
    action: 'unlock_for_delivery',
    detail: `Courier verified on camera: box opened for ${UNLOCK_WINDOW_MS / 60000} min and a one-time code issued`,
  })
  await save(lock)
  return { code, expiresAt: lock.activeCode.expiresAt }
}

export async function manualAction(action: 'lock' | 'unlock' | 'reset', code?: string, now = Date.now()) {
  if (action === 'reset') {
    const lock = fresh()
    lock.log.unshift({ at: now, action: 'reset', detail: 'Simulator reset' })
    await save(lock)
    return lock
  }
  const lock = await getLock(now)
  if (action === 'lock') {
    lock.locked = true
    lock.unlockedUntil = undefined
    lock.log.unshift({ at: now, action: 'lock', detail: 'Locked by resident' })
  } else {
    if (!lock.activeCode || lock.activeCode.code !== code) {
      lock.log.unshift({ at: now, action: 'code_rejected', detail: 'Wrong or expired code entered' })
      await save(lock)
      throw new Error('Wrong or expired code')
    }
    lock.locked = false
    lock.unlockedUntil = now + UNLOCK_WINDOW_MS
    lock.log.unshift({ at: now, action: 'code_used', detail: 'Opened with the one-time delivery code' })
    lock.activeCode = undefined
  }
  await save(lock)
  return lock
}
