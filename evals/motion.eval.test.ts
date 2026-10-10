// A still scene sent as a 3-frame burst must not be reported as movement.
// Run: npm run eval:motion   (calls Bedrock)
import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { describeFrame } from '@/lib/perception/describe'

const frames = [
  'playground-package-on-step.jpg',
  'playground-vehicle-empty-driveway.jpg',
  'playground-motion-birds.jpg',
]

describe('bursts of a still scene', () => {
  for (const file of frames) {
    it(
      file,
      async () => {
        const image = readFileSync(path.join(__dirname, 'frames', file))
        const p = await describeFrame({ image, earlier: [image, image], mediaType: 'image/jpeg' })
        console.log(`${file}: [${p.category}] "${p.caption}" motion=${p.motion} ${p.latencyMs}ms`)
        expect(['staying', 'none', undefined]).toContain(p.motion)
      },
      60_000,
    )
  }
})
