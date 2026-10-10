import { NextRequest, NextResponse } from 'next/server'
import { ExpectationError, cancelExpectation, createExpectation, listExpectations } from '@/lib/expectations/service'

export const dynamic = 'force-dynamic'

function fail(err: unknown) {
  const status = err instanceof ExpectationError ? 400 : 500
  return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status })
}

export async function GET() {
  return NextResponse.json({ expectations: await listExpectations() })
}

/** { kind: 'visitor' | 'parcel', label, from, until } or { kind: 'household', label } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    return NextResponse.json({ expectation: await createExpectation(body) })
  } catch (err) {
    return fail(err)
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    return NextResponse.json({ expectation: await cancelExpectation(id) })
  } catch (err) {
    return fail(err)
  }
}
