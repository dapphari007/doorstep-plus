import { NextResponse } from 'next/server'
import { listDevices } from '@/lib/ring/client'
import { blockedInDemo } from '@/lib/demo'

export const dynamic = 'force-dynamic'

export async function GET() {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  try {
    return NextResponse.json({ devices: await listDevices() })
  } catch (err) {
    return NextResponse.json({ devices: [], error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
