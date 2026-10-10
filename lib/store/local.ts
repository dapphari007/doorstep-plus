// File-backed store for local development: .data/db.json plus .data/snapshots/.

import { promises as fs, existsSync, readFileSync } from 'fs'
import path from 'path'
import type { DeliveryRecord, DoorEvent, LockState } from '../types'
import { filterAndSort, type ListOptions, type Store } from './types'

interface Db {
  events: Record<string, DoorEvent>
  deliveries: Record<string, DeliveryRecord>
  lock?: LockState
}

function safeName(id: string) {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export class LocalStore implements Store {
  readonly kind = 'local' as const
  private db: Db
  private dbPath: string
  private snapDir: string
  private writing: Promise<void> = Promise.resolve()

  constructor(dir: string) {
    this.dbPath = path.join(dir, 'db.json')
    this.snapDir = path.join(dir, 'snapshots')
    this.db = existsSync(this.dbPath)
      ? JSON.parse(readFileSync(this.dbPath, 'utf8'))
      : { events: {}, deliveries: {} }
  }

  private persist() {
    // Serialise writes so concurrent updates never interleave on disk.
    this.writing = this.writing.then(async () => {
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true })
      const tmp = `${this.dbPath}.tmp`
      await fs.writeFile(tmp, JSON.stringify(this.db, null, 2))
      await fs.rename(tmp, this.dbPath)
    })
    return this.writing
  }

  async getEvent(id: string) {
    return this.db.events[id]
  }
  async putEvent(event: DoorEvent) {
    this.db.events[event.id] = event
    await this.persist()
  }
  async listEvents(opts?: ListOptions) {
    return filterAndSort(Object.values(this.db.events), opts)
  }
  async putSnapshot(eventId: string, bytes: Buffer, contentType: string) {
    await fs.mkdir(this.snapDir, { recursive: true })
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    await fs.writeFile(path.join(this.snapDir, `${safeName(eventId)}.${ext}`), bytes)
  }
  async getSnapshot(eventId: string) {
    for (const [ext, contentType] of [['jpg', 'image/jpeg'], ['png', 'image/png']] as const) {
      const p = path.join(this.snapDir, `${safeName(eventId)}.${ext}`)
      if (existsSync(p)) return { bytes: await fs.readFile(p), contentType }
    }
    return undefined
  }
  async getDelivery(id: string) {
    return this.db.deliveries[id]
  }
  async putDelivery(delivery: DeliveryRecord) {
    this.db.deliveries[delivery.id] = delivery
    await this.persist()
  }
  async listDeliveries(limit = 100) {
    return filterAndSort(Object.values(this.db.deliveries), { limit })
  }
  async getLock() {
    return this.db.lock
  }
  async putLock(lock: LockState) {
    this.db.lock = lock
    await this.persist()
  }
}
