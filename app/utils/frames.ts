// Frame capture from the live <video>, plus a cheap "did anything change?" check
// so keep-watching only calls the AI when the picture actually moved.

const MAX_WIDTH = 1280
const THUMB_W = 32
const THUMB_H = 18

/** Mean brightness difference (0-255) above which two thumbnails count as changed. */
export const CHANGE_THRESHOLD = 6

export interface Frame {
  dataUrl: string
  thumb: Uint8Array
}

/** Average absolute difference between two grayscale thumbnails, 0-255. */
export function frameDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length || !a.length) return 255
  let total = 0
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i])
  return total / a.length
}

/** True if any frame differs from the reference enough to be worth describing. */
export function hasChanged(frames: Uint8Array[], reference: Uint8Array | undefined, threshold = CHANGE_THRESHOLD) {
  if (!reference) return true
  return frames.some((f) => frameDifference(f, reference) >= threshold)
}

function grayscaleThumb(source: CanvasImageSource): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = THUMB_H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return new Uint8Array()
  ctx.drawImage(source, 0, 0, THUMB_W, THUMB_H)
  const { data } = ctx.getImageData(0, 0, THUMB_W, THUMB_H)
  const out = new Uint8Array(THUMB_W * THUMB_H)
  for (let i = 0; i < out.length; i++)
    out[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000
  return out
}

export function captureFrame(video: HTMLVideoElement | null): Frame | undefined {
  if (!video || !video.videoWidth || !video.videoHeight) return undefined
  const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), thumb: grayscaleThumb(canvas) }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A few frames about `gapMs` apart, oldest first. Stops early if the video goes away. */
export async function captureBurst(video: HTMLVideoElement | null, count = 3, gapMs = 700): Promise<Frame[]> {
  const frames: Frame[] = []
  for (let i = 0; i < count; i++) {
    if (i > 0) await wait(gapMs)
    const frame = captureFrame(video)
    if (!frame) break
    frames.push(frame)
  }
  return frames
}
