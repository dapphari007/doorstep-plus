// One Ring frame in, one safe structured description out (Claude via Mantle, others via Converse).

import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk'
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import sharp from 'sharp'
import { config } from '../config'
import { PerceptionSchema, type ModelPerception, type Perception } from './schema'
import { applySafety } from './safety'
import { fixturePerception } from './fixture'

const SYSTEM_PROMPT = `You describe single frames from a home doorbell camera for an accessibility app.
Your descriptions are read aloud to blind users and shown as large captions and light signals to deaf users, so they must be short, concrete and calm.

Describe WHAT is happening, never WHO someone is:
- Never identify, name or guess the identity or relationship of anyone.
- Never mention race, ethnicity, skin colour, apparent age beyond "child", or other sensitive traits.
- Never read or repeat licence plates, house numbers or other identifying text.
- Only call something an animal when you can clearly see an animal and no person.
- Uniforms, branded vans and parcels are fine to mention ("a delivery driver in a brown uniform").

Look at the WHOLE frame before answering, including the edges and the foreground closest to the camera (doorbells look down at the step, so the most important things are often at the bottom of the image).
Packages matter most: boxes, padded mailers, bags or envelopes on the step, porch, mat or ground. If any is visible, set package.present = true, mention it in the caption, and use category "delivery" even when no person is in view (package.action "present"). A shipping label is a strong sign of a package.

The image carries a Ring watermark (logo, timestamps, device text). Ignore it completely.
If the frame is dark, blurry or empty, say so and lower your confidence instead of guessing.

Reply with ONLY a JSON object, no prose, matching this TypeScript type:
{
  "category": "delivery" | "visitor" | "vehicle" | "animal" | "no_activity" | "other",
  "caption": string,          // <= 12 words, present tense, e.g. "Delivery driver leaving a box on the step"
  "details": string,          // 1-2 sentences with useful specifics (where the package is, what the person is doing)
  "actors": { "role": "delivery_person" | "person" | "child" | "group" | "unclear", "action": string }[],
  "atDoor": boolean,          // true if a person is at or walking up to the door; false if only passing in the background (street, sidewalk)
  "motion": "arriving" | "leaving" | "passing" | "staying" | "none",   // movement across the frames; arriving/leaving = coming to or going from THIS home's door or driveway; moving through a street or parking lot is "passing"; "none" if only one frame or nothing moves
  "package": { "present": boolean, "action": "dropped_off" | "picked_up" | "present" | "none" | "unclear" },
  "vehicle": { "present": boolean, "kind"?: string },   // kind like "delivery van", "car", "truck"
  "carrierGuess"?: string,    // only from visible uniform/van branding, e.g. "UPS"; omit otherwise
  "urgency": "low" | "normal" | "high",                 // high only for apparent emergencies, smoke, someone falling
  "confidence": number        // 0-1, how sure you are of the description
}`

let client: AnthropicBedrockMantle | undefined
function bedrock() {
  client ??= new AnthropicBedrockMantle({ awsRegion: config.aws.region })
  return client
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Model reply contained no JSON object')
  return JSON.parse(text.slice(start, end + 1))
}

export interface DescribeInput {
  /** The latest frame. */
  image: Buffer
  mediaType: 'image/jpeg' | 'image/png'
  /** Earlier frames from the same moment, oldest first, about a second apart. */
  earlier?: Buffer[]
  /** Ring's own hints, e.g. "motion" / "package_delivery". Helps, never overrides the image. */
  ringHint?: string
  /** Used only in fixture mode to pick a canned scene. */
  fixtureScene?: string
}

type Turn = {
  role: 'user' | 'assistant'
  text: string
  images?: { bytes: Buffer; mediaType: 'image/jpeg' | 'image/png' }[]
}

/** Claude models go through Anthropic's Bedrock Mantle client. */
async function askClaude(turns: Turn[]): Promise<string> {
  const response = await bedrock().messages.create({
    model: config.aws.perceptionModel,
    max_tokens: 2000,
    // Captioning is latency-sensitive and simple: low effort keeps it fast.
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: turns.map((t) => ({
      role: t.role,
      content: [
        ...(t.images ?? []).map((img) => ({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.bytes.toString('base64') },
        })),
        { type: 'text', text: t.text },
      ],
    })),
  } as any)
  if (response.stop_reason === 'refusal') throw new Error('The model declined to describe this frame')
  return response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
}

let runtime: BedrockRuntimeClient | undefined

/** Any other Bedrock vision model (e.g. Amazon Nova) through the Converse API. */
async function askConverse(turns: Turn[]): Promise<string> {
  runtime ??= new BedrockRuntimeClient({ region: config.aws.region })
  const res = await runtime.send(
    new ConverseCommand({
      modelId: config.aws.perceptionModel,
      system: [{ text: SYSTEM_PROMPT }],
      inferenceConfig: { maxTokens: 800, temperature: 0.2 },
      messages: turns.map((t) => ({
        role: t.role,
        content: [
          ...(t.images ?? []).map((img) => ({
            image: {
              format: img.mediaType === 'image/png' ? ('png' as const) : ('jpeg' as const),
              source: { bytes: img.bytes },
            },
          })),
          { text: t.text },
        ],
      })),
    }),
  )
  return (res.output?.message?.content || []).map((c) => c.text || '').join('')
}

/** Mean brightness 0-255 of an image, or undefined if it can't be read. */
export async function brightnessOf(image: Buffer): Promise<number | undefined> {
  try {
    const { channels } = await sharp(image).stats()
    const rgb = channels.slice(0, 3)
    return rgb.reduce((sum, c) => sum + c.mean, 0) / rgb.length
  } catch {
    return undefined
  }
}

export function isClaudeModel(modelId: string) {
  return modelId.includes('anthropic.')
}

export async function describeFrame(input: DescribeInput): Promise<Perception> {
  const started = Date.now()
  if (config.fixtures) {
    const fx = fixturePerception(input.fixtureScene || input.ringHint)
    return { ...applySafety(fx), model: 'fixture', latencyMs: Date.now() - started }
  }

  const ask = isClaudeModel(config.aws.perceptionModel) ? askClaude : askConverse
  const frames = [...(input.earlier ?? []), input.image].map((bytes) => ({ bytes, mediaType: input.mediaType }))
  const instruction =
    frames.length > 1
      ? `You get ${frames.length} frames from the doorbell's live video, about a second apart, oldest first. ` +
        'Describe the LAST frame exactly as you would a single frame: check every part of it, especially packages. ' +
        'Use the earlier frames ONLY to set "motion" (arriving, leaving or passing by). ' +
        'A car or person moving through a street or parking lot is "passing", not "arriving". ' +
        'The caption must match the motion: for "passing" say passing or driving past (e.g. "Car driving past the driveway"), ' +
        'never "leaving" or "moving away" unless it was parked there and drove off. ' +
        'If the frames look the same or only something tiny moved, motion is "staying" (something is there) or "none" (nothing is there).'
      : 'Describe the frame.'
  const turns: Turn[] = [
    {
      role: 'user',
      images: frames,
      text: input.ringHint ? `Ring reported this event as: ${input.ringHint}. ${instruction}` : instruction,
    },
  ]

  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await ask(turns)
    try {
      const parsed: ModelPerception = PerceptionSchema.parse(extractJson(text))
      return {
        ...applySafety(parsed, { brightness: await brightnessOf(input.image) }),
        model: config.aws.perceptionModel,
        latencyMs: Date.now() - started,
      }
    } catch (err) {
      lastError = err
      turns.push({ role: 'assistant', text: text || '(empty)' })
      turns.push({
        role: 'user',
        text: `That reply did not match the required JSON type (${String(err).slice(0, 300)}). Reply again with only the corrected JSON object.`,
      })
    }
  }
  throw new Error(`Could not get a valid description: ${String(lastError)}`)
}
