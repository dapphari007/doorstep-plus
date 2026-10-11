import { NextResponse } from 'next/server'
import { blockedInDemo } from '@/lib/demo'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

/** Clears the activity history: events, deliveries and expected arrivals. Ring's own history is untouched. */
export async function DELETE() {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  try {
    return NextResponse.json({ removed: await getStore().clearActivity() })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
