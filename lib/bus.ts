// In-process fan-out to Server-Sent Events clients.

import type { BusMessage } from './types'

type Listener = (msg: BusMessage) => void
const g = globalThis as unknown as { __doorstepListeners?: Set<Listener> }
const listeners = (g.__doorstepListeners ??= new Set<Listener>())

export function publish(msg: BusMessage) {
  listeners.forEach((fn) => {
    try {
      fn(msg)
    } catch {
      listeners.delete(fn)
    }
  })
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
