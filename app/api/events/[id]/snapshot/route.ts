import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const snap = await getStore().getSnapshot(id)
  if (!snap) return NextResponse.json({ error: 'No snapshot' }, { status: 404 })
  return new Response(new Uint8Array(snap.bytes), {
    headers: { 'Content-Type': snap.contentType, 'Cache-Control': 'private, max-age=86400' },
  })
}
