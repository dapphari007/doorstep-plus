import { NextResponse } from 'next/server'
import { getLock } from '@/lib/delivery/lock'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [deliveries, lock] = await Promise.all([getStore().listDeliveries(50), getLock()])
  return NextResponse.json({ deliveries, lock })
}
