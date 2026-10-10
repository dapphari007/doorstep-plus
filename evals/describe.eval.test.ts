// Runs the real perception code on saved Ring frames (calls Bedrock). Run: npm run eval
import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { describeFrame } from '@/lib/perception/describe'

const dir = path.join(__dirname, 'frames')
const expectations: Record<string, any> = JSON.parse(readFileSync(path.join(dir, 'expectations.json'), 'utf8'))

describe(`perception: ${process.env.PERCEPTION_MODEL_ID}`, () => {
  for (const [file, want] of Object.entries(expectations)) {
    it(
      file,
      async () => {
        const p = await describeFrame({ image: readFileSync(path.join(dir, file)), mediaType: 'image/jpeg' })
        console.log(
          `${file}: [${p.category}] "${p.caption}" package=${JSON.stringify(p.package)} actors=${p.actors.length} conf=${p.confidence} ${p.latencyMs}ms`,
        )
        if ('package.present' in want) expect(p.package.present).toBe(want['package.present'])
        if (want.category) expect(want.category).toContain(p.category)
        if ('actors.max' in want) expect(p.actors.length).toBeLessThanOrEqual(want['actors.max'])
      },
      60_000,
    )
  }
})
