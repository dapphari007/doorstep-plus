import { NextResponse } from 'next/server'
import { camerasFromDevices, listDevices } from '@/lib/ring/client'
import { blockedInDemo } from '@/lib/demo'

export const dynamic = 'force-dynamic'

export async function GET() {
  const blocked = blockedInDemo()
  if (blocked) return blocked
  try {
    const devices = await listDevices()
    return NextResponse.json({ devices, cameras: camerasFromDevices(devices) })
  } catch (err) {
    return NextResponse.json(
      { devices: [], cameras: [], error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
