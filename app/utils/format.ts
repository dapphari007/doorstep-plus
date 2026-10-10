const MINUTE = 60_000
const HOUR = 60 * MINUTE

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** "Just now", "5 min ago", "2:14 PM", "Yesterday, 2:14 PM", "Mon 6 Oct, 2:14 PM". */
export function relativeTime(ms: number, now = Date.now()): string {
  const diff = now - ms
  if (diff < 0 || diff < MINUTE) return 'Just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`
  const day = dayLabel(ms, now)
  if (day === 'Today') return clockTime(ms)
  return `${day}, ${clockTime(ms)}`
}

export function dayLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms)
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

export function secondsLeft(until: number | undefined, now = Date.now()): number {
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0
}

/** Pull a readable message out of any thrown value or API error body. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}

/** fetch + JSON with a readable error for non-2xx or non-JSON responses. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  let body: any = null
  try {
    body = await res.json()
  } catch {
    // empty or non-JSON body
  }
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`)
  return body as T
}

export function postJson<T>(url: string, data: unknown, init?: RequestInit): Promise<T> {
  return fetchJson<T>(url, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** "3:00 – 4:00 PM", "Any time today", "Tomorrow, 9:00 – 10:00 AM". */
export function windowLabel(from: number, until: number, now = Date.now()): string {
  const day = dayLabel(from, now)
  const prefix = day === 'Today' ? '' : `${day}, `
  const allDay = until - from >= 12 * HOUR
  if (allDay) return `Any time ${day === 'Today' ? 'today' : day.toLowerCase()}`
  return `${prefix}${clockTime(from)} – ${clockTime(until)}`
}

/** Epoch ms for a browser-local "HH:MM" today (+dayOffset days). */
export function localClockToEpoch(hhmm: string, dayOffset = 0, now = new Date()): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(now)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}
