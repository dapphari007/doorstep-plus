import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined)
  const events = await getStore().listEvents({ since: num('since'), until: num('until'), limit: num('limit') ?? 100 })
  return NextResponse.json({ events })
}
