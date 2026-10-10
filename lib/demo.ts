import { NextResponse } from 'next/server'
import { config } from './config'

/** In the public read-only demo, actions that change data or need a Ring token return 403. */
export function blockedInDemo(): NextResponse | undefined {
  if (!config.demo) return undefined
  return NextResponse.json(
    { error: 'This is a read-only demo with recorded Ring events. Run the app locally to use this.' },
    { status: 403 },
  )
}
