// When a scene ends, its merged frames become one sentence: the final word on what happened.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { alertKindForEvent, isSilent } from '../alerts'
import { publish } from '../bus'
import { config } from '../config'
import { scrubText } from '../perception/safety'
import { getStore } from '../store'
import type { DoorEvent } from '../types'

/** A scene with no new frames for this long is over. */
export const SCENE_QUIET_MS = 45_000
const OPEN_SCENE_LOOKBACK_MS = 10 * 60_000

const g = globalThis as unknown as { sceneTimers?: Map<string, ReturnType<typeof setTimeout>>; closing?: Set<string> }
const timers = (g.sceneTimers ??= new Map())
const closing = (g.closing ??= new Set())

/** Each frame of the scene as the model saw it, with the camera view when it named one. */
export function sceneLines(e: DoorEvent): string[] {
  const frames = [
    { caption: e.perception?.caption, view: e.perception?.view },
    ...(e.updates ?? []).map((u) => ({ caption: u.caption, view: u.view })),
  ]
  return frames.filter((f) => !!f.caption).map((f) => (f.view ? `${f.caption} (view: ${f.view})` : f.caption!))
}

export function sceneCaptions(e: DoorEvent): string[] {
  return [e.perception?.caption, ...(e.updates ?? []).map((u) => u.caption)].filter((c): c is string => !!c)
}

/** Used when the model is unavailable: "Car driving through the lot, then car passing the driveway". */
export function fallbackSummary(captions: string[]): string {
  if (captions.length < 2) return captions[0] ?? ''
  const rest = captions[captions.length - 1]
  return `${captions[0]}, then ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`
}

/**
 * Passing or parked scenes never alerted, so their summary is the one notification they get.
 * Alerting scenes only need one when later frames added something; their alert said the rest.
 * An empty view is not a scene.
 */
export function needsSummary(e: DoorEvent): boolean {
  const kind = alertKindForEvent(e)
  if (kind === 'quiet') return false
  return isSilent(kind) || !!e.updates?.length
}

let runtime: BedrockRuntimeClient | undefined

async function summarize(captions: string[], lines = captions): Promise<string> {
  if (config.fixtures) return fallbackSummary(captions)
  runtime ??= new BedrockRuntimeClient({ region: config.aws.region })
  const res = await runtime.send(
    new ConverseCommand({
      modelId: config.aws.perceptionModel,
      inferenceConfig: { maxTokens: 60, temperature: 0.2 },
      messages: [
        {
          role: 'user',
          content: [
            {
              text:
                'These captions describe one scene at a home camera, oldest first:\n' +
                lines.map((c, i) => `${i + 1}. ${c}`).join('\n') +
                '\n\nWrite ONE sentence, at most 12 words, past tense, telling the resident what happened overall; ' +
                'when the view changes, follow the movement from one place to the next, ' +
                'e.g. "A car drove through the parking lot and past your driveway." ' +
                'If the captions only reword the same thing, say it once; never invent movement or places that are not listed. ' +
                'Say what happened, never who; no guesses about identity. Reply with the sentence only.',
            },
          ],
        },
      ],
    }),
  )
  const text = (res.output?.message?.content ?? [])
    .map((c) => c.text ?? '')
    .join('')
    .trim()
  return text.replace(/^["']|["']$/g, '') || fallbackSummary(captions)
}

/** Writes the summary for a finished scene and tells the app. Scenes without updates need none. */
export async function closeScene(id: string) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  if (closing.has(id)) return
  closing.add(id)
  try {
    const store = getStore()
    const event = await store.getEvent(id)
    if (!event || event.summary) return
    if (!needsSummary(event)) return
    const captions = sceneCaptions(event)
    let summary: string
    try {
      summary = captions.length < 2 ? captions[0] : await summarize(captions, sceneLines(event))
    } catch (err) {
      console.warn('[scenes] summary failed, using captions:', err)
      summary = fallbackSummary(captions)
    }
    event.summary = scrubText(summary)
    await store.putEvent(event)
    publish({ kind: 'event', event })
  } finally {
    closing.delete(id)
  }
}

/** The scene is still going: push its end back. */
export function touchScene(id: string) {
  clearTimeout(timers.get(id))
  timers.set(
    id,
    setTimeout(() => void closeScene(id), SCENE_QUIET_MS),
  )
}

/** A new scene started, so every earlier live scene is over. */
export async function closeOpenScenes(exceptId: string) {
  const recent = await getStore().listEvents({ since: Date.now() - OPEN_SCENE_LOOKBACK_MS, limit: 50 })
  const open = recent.filter(
    (e) => e.id !== exceptId && e.source === 'live_frame' && !e.repeatOf && !e.summary && e.status === 'described',
  )
  await Promise.all(open.map((e) => closeScene(e.id)))
}
