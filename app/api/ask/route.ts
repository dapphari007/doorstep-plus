import { NextRequest, NextResponse } from 'next/server'
import { askDoor } from '@/lib/agent/ask'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { question, history } = await req.json()
    if (typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'Ask a question' }, { status: 400 })
    }
    const answer = await askDoor(question.slice(0, 1000), Array.isArray(history) ? history : [])
    return NextResponse.json(answer)
  } catch (err) {
    console.error('[ask]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not answer' }, { status: 500 })
  }
}
