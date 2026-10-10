import { publish } from '../bus'
import { LOW_CONFIDENCE } from '../perception/safety'
import { getStore } from '../store'
import type { DeliveryRecord, DoorEvent } from '../types'
import { issueDeliveryCode } from './lock'

export const VERIFY_CONFIDENCE = 0.6
const TAKEN_LOOKBACK_MS = 24 * 3600_000

export function isDropOff(event: DoorEvent): boolean {
  const p = event.perception
  if (!p) return event.subType === 'package_delivery'
  return p.package.action === 'dropped_off' || (event.subType === 'package_delivery' && p.package.present)
}

export function isVerifiedDropOff(event: DoorEvent): boolean {
  const p = event.perception
  return (
    !!p &&
    p.confidence >= Math.max(VERIFY_CONFIDENCE, LOW_CONFIDENCE) &&
    p.package.present &&
    p.actors.some((a) => a.role === 'delivery_person')
  )
}

async function findOpenDelivery(before: number): Promise<DeliveryRecord | undefined> {
  return (await getStore().listDeliveries(50)).find(
    (d) => d.status !== 'taken' && d.at <= before && before - d.at < TAKEN_LOOKBACK_MS,
  )
}

export async function handleDeliveryLogic(event: DoorEvent): Promise<DeliveryRecord | undefined> {
  const store = getStore()
  const p = event.perception

  if (isDropOff(event)) {
    const verified = isVerifiedDropOff(event)
    const delivery: DeliveryRecord = {
      id: `dlv_${event.id}`.slice(0, 120),
      eventId: event.id,
      at: event.start,
      status: verified ? 'verified' : 'needs_review',
      carrierGuess: p?.carrierGuess,
      summary: p?.details || p?.caption || 'Package delivery reported by Ring',
    }
    if (verified) {
      const { code, expiresAt } = await issueDeliveryCode(delivery.id)
      delivery.code = code
      delivery.codeExpiresAt = expiresAt
    }
    await store.putDelivery(delivery)
    publish({ kind: 'delivery', delivery })
    return delivery
  }

  // Package already at the door, no courier seen: track it so a pickup can be flagged.
  if (p?.package.present && p.package.action === 'present' && !(await findOpenDelivery(event.start))) {
    const delivery: DeliveryRecord = {
      id: `dlv_${event.id}`.slice(0, 120),
      eventId: event.id,
      at: event.start,
      status: 'needs_review',
      carrierGuess: p.carrierGuess,
      summary: `Package spotted at the door. ${p.details}`,
    }
    await store.putDelivery(delivery)
    publish({ kind: 'delivery', delivery })
    return delivery
  }

  if (p?.package.action === 'picked_up') {
    const open = await findOpenDelivery(event.start)
    if (open) {
      open.status = 'taken'
      open.takenEventId = event.id
      open.takenAt = event.start
      await store.putDelivery(open)
      publish({ kind: 'delivery', delivery: open })
      return open
    }
  }
  return undefined
}
