// Optional webhook so a smart light can flash the same alert pattern.

import { PATTERNS, alertKindFor } from '../alerts'
import { config } from '../config'
import type { DoorEvent } from '../types'

export async function notifyLight(event: DoorEvent): Promise<void> {
  if (!config.lightWebhookUrl || !event.perception) return
  const pattern = PATTERNS[alertKindFor(event.perception)]
  if (pattern.kind === 'quiet') return
  try {
    await fetch(config.lightWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'doorstep-plus',
        kind: pattern.kind,
        color: pattern.color,
        rhythm_ms: pattern.rhythm,
        caption: event.perception.caption,
        at: new Date(event.start).toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    })
  } catch (err) {
    console.warn('[light] webhook failed:', err instanceof Error ? err.message : err)
  }
}
