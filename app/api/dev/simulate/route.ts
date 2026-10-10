import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { FIXTURE_SCENES } from '@/lib/perception/fixture'
import { processRingEvent } from '@/lib/pipeline'

/** FIXTURE_MODE only: inject a fake Ring event to exercise the pipeline without Ring or AWS. */
export async function POST(req: NextRequest) {
  if (!config.fixtures) return NextResponse.json({ error: 'Only available with FIXTURE_MODE=true' }, { status: 404 })
  const { scene } = await req.json()
  if (!FIXTURE_SCENES.includes(scene)) return NextResponse.json({ error: `scene must be one of ${FIXTURE_SCENES}` }, { status: 400 })
  const now = Date.now()
  const event = await processRingEvent({
    id: `fixture_${scene}_${now}`,
    deviceId: 'fixture-device',
    ringType: 'on_demand',
    subType: scene,
    start: now,
    source: 'fixture',
  })
  return NextResponse.json({ event })
}
