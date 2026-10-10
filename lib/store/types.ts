import type { DeliveryRecord, DoorEvent, Expectation, LockState } from '../types'

export interface ListOptions {
  since?: number
  until?: number
  limit?: number
}

export interface Store {
  readonly kind: 'local' | 'aws'
  getEvent(id: string): Promise<DoorEvent | undefined>
  putEvent(event: DoorEvent): Promise<void>
  /** Newest first. */
  listEvents(opts?: ListOptions): Promise<DoorEvent[]>
  putSnapshot(eventId: string, bytes: Buffer, contentType: string): Promise<void>
  getSnapshot(eventId: string): Promise<{ bytes: Buffer; contentType: string } | undefined>
  getDelivery(id: string): Promise<DeliveryRecord | undefined>
  putDelivery(delivery: DeliveryRecord): Promise<void>
  /** Newest first. */
  listDeliveries(limit?: number): Promise<DeliveryRecord[]>
  getLock(): Promise<LockState | undefined>
  putLock(lock: LockState): Promise<void>
  getExpectation(id: string): Promise<Expectation | undefined>
  putExpectation(expectation: Expectation): Promise<void>
  /** Newest window first. */
  listExpectations(limit?: number): Promise<Expectation[]>
}

export function filterAndSort<T extends { start?: number; at?: number; from?: number }>(
  items: T[],
  opts: ListOptions = {},
): T[] {
  const time = (x: T) => x.start ?? x.at ?? x.from ?? 0
  return items
    .filter(
      (x) => (opts.since === undefined || time(x) >= opts.since) && (opts.until === undefined || time(x) <= opts.until),
    )
    .sort((a, b) => time(b) - time(a))
    .slice(0, opts.limit ?? 200)
}
