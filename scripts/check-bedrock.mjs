// Checks both Bedrock models answer (image + agent). Run: npm run check:bedrock

import { deflateSync } from 'zlib'
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk'
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { Agent, BedrockModel } from '@strands-agents/sdk'

const region = process.env.AWS_REGION || 'us-east-1'
const perceptionModel = process.env.PERCEPTION_MODEL_ID || 'us.amazon.nova-2-lite-v1:0'
const agentModel = process.env.AGENT_MODEL_ID || 'us.amazon.nova-2-lite-v1:0'

const auth = process.env.AWS_BEARER_TOKEN_BEDROCK
  ? 'Bedrock API key'
  : process.env.AWS_PROFILE || process.env.AWS_ACCESS_KEY_ID
    ? 'AWS credentials (env)'
    : 'default AWS credential chain (~/.aws: aws login / aws configure)'
console.log(`Region: ${region}\nAuth: ${auth}\n`)

/** A 64x64 PNG (sky, grass and a brown box), enough to prove image input works. */
function testPng() {
  const w = 64
  const h = 64
  const rows = []
  for (let y = 0; y < h; y++) {
    const row = [0]
    for (let x = 0; x < w; x++) {
      const box = x > 20 && x < 44 && y > 32 && y < 56
      row.push(...(box ? [150, 100, 50] : y < 32 ? [120, 170, 230] : [90, 140, 70]))
    }
    rows.push(Buffer.from(row))
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const prompt = 'In five words or fewer, what does this image show?'
const png = testPng()
let ok = true

try {
  let text
  const started = Date.now()
  if (perceptionModel.includes('anthropic.')) {
    const client = new AnthropicBedrockMantle({ awsRegion: region })
    const res = await client.messages.create({
      model: perceptionModel,
      max_tokens: 200,
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })
    text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  } else {
    const client = new BedrockRuntimeClient({ region })
    const res = await client.send(
      new ConverseCommand({
        modelId: perceptionModel,
        inferenceConfig: { maxTokens: 100 },
        messages: [{ role: 'user', content: [{ image: { format: 'png', source: { bytes: png } } }, { text: prompt }] }],
      }),
    )
    text = res.output.message.content.map((c) => c.text || '').join('')
  }
  console.log(`✔ Perception model ${perceptionModel} (image in, ${Date.now() - started} ms): "${text.trim()}"`)
} catch (err) {
  ok = false
  console.log(`✘ Perception model ${perceptionModel}: ${err?.status ?? err?.name ?? ''} ${err?.message ?? err}`)
}

try {
  const agent = new Agent({
    model: new BedrockModel({ region, modelId: agentModel, maxTokens: 50 }),
    printer: false,
  })
  const result = await agent.invoke('Reply with the single word: ready')
  console.log(`✔ Agent model ${agentModel} (Strands): "${String(result).trim()}"`)
} catch (err) {
  ok = false
  console.log(`✘ Agent model ${agentModel} (Strands): ${err?.name ?? ''} ${err?.message ?? err}`)
}

process.exit(ok ? 0 : 1)
