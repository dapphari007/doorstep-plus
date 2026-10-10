import { NextResponse } from 'next/server'
import { listDevices } from '@/lib/ring/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ devices: await listDevices() })
  } catch (err) {
    return NextResponse.json({ devices: [], error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
