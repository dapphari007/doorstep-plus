import { NextRequest, NextResponse } from 'next/server'
import { askDoor } from '@/lib/agent/ask'
import { config } from '@/lib/config'
import { clientKey, createLimiter } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

// The public demo pays for every question, so it gets limits; local use does not.
const demoLimit = createLimiter({ perKey: 10, perKeyWindowMs: 3600_000, total: 200, totalWindowMs: 24 * 3600_000 })

export async function POST(req: NextRequest) {
  try {
    const { question, history } = await req.json()
    if (typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'Ask a question' }, { status: 400 })
    }
    if (config.demo) {
      const limit = demoLimit(clientKey(req.headers))
      if (!limit.ok) {
        const text =
          limit.reason === 'visitor'
            ? 'You have asked a lot of questions in this demo. Please try again later.'
            : 'The demo has reached its question limit for today. Please try again tomorrow.'
        return NextResponse.json(
          { error: text },
          { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec ?? 60) } },
        )
      }
    }
    const maxLength = config.demo ? 300 : 1000
    const turns = Array.isArray(history) ? history.slice(-6) : []
    const answer = await askDoor(question.slice(0, maxLength), turns)
    return NextResponse.json(answer)
  } catch (err) {
    console.error('[ask]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not answer' }, { status: 500 })
  }
}
