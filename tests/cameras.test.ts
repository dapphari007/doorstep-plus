import { describe, expect, it } from 'vitest'
import { spokenText } from '@/lib/alerts'
import type { Perception } from '@/lib/perception/schema'
import { cameraLabel, camerasFromDevices, type RingDevice } from '@/lib/ring/client'
import { parseRingWebhook } from '@/lib/ring/webhook'
import { sceneLines } from '@/lib/scenes/summary'
import type { DoorEvent } from '@/lib/types'

const doorbell: RingDevice = { id: 'door', name: 'Front Door', online: true, e2eEncrypted: false }
const elite: RingDevice = {
  id: 'elite',
  name: 'Back Yard',
  online: true,
  e2eEncrypted: false,
  components: [
    { id: '0', name: 'View 1' },
    { id: '1', name: 'View 2' },
  ],
}

describe('cameras', () => {
  it('lists one view per device, and one per camera module on multi-camera devices', () => {
    expect(camerasFromDevices([doorbell, elite]).map((c) => c.name)).toEqual([
      'Front Door',
      'Back Yard · View 1',
      'Back Yard · View 2',
    ])
  })

  it('names the camera only when the home has more than one view', () => {
    expect(cameraLabel(camerasFromDevices([doorbell]), 'door')).toBeUndefined()
    const all = camerasFromDevices([doorbell, elite])
    expect(cameraLabel(all, 'elite', '1')).toBe('Back Yard · View 2')
    expect(cameraLabel(all, 'elite')).toBe('Back Yard')
  })

  it('reads which camera modules saw the motion', () => {
    const evt = parseRingWebhook({
      data: { type: 'motion_detected', attributes: { source: 'elite', timestamp: 1, component_ids: ['1'] } },
    })
    expect(evt?.componentIds).toEqual(['1'])
  })

  it('says which camera saw it', () => {
    const perception = { category: 'vehicle', caption: 'Car arriving', package: { present: false } } as Perception
    const e = { ringType: 'on_demand', start: 0, perception, cameraName: 'Driveway' }
    expect(spokenText(e, 'UTC')).toMatch(/^Driveway: /)
  })
})

describe('camera views in a scene', () => {
  it('gives the summary each view in order', () => {
    const e = {
      perception: { caption: 'Car crossing the lot', view: 'parking lot' },
      updates: [{ at: 1, caption: 'Car driving past', view: 'driveway' }],
    } as DoorEvent
    expect(sceneLines(e)).toEqual(['Car crossing the lot (view: parking lot)', 'Car driving past (view: driveway)'])
  })
})

describe('camera online and offline', () => {
  it('reads Ring device webhooks', () => {
    const evt = parseRingWebhook({ data: { type: 'device_offline', attributes: { source: 'door', timestamp: 5 } } })
    expect(evt).toMatchObject({ type: 'device_offline', deviceId: 'door', timestamp: 5 })
  })

  it('makes going offline an alert and coming back a quiet notice', async () => {
    const { isSilent } = await import('@/lib/alerts')
    expect(isSilent('offline')).toBe(false)
    expect(isSilent('online')).toBe(true)
  })
})
