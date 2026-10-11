import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { maskPrivacyZones } from '@/lib/perception/privacy'
import { zonesFor, type RingDevice } from '@/lib/ring/client'

const white = () =>
  sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffffff' } })
    .jpeg()
    .toBuffer()

async function brightnessAt(image: Buffer, x: number, y: number) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true })
  return data[(y * info.width + x) * info.channels]
}

describe('privacy zones', () => {
  it('blacks out the zone and leaves the rest of the frame alone', async () => {
    const zone = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 0, y: 0.5 },
    ]
    const masked = await maskPrivacyZones(await white(), [zone])
    expect(await brightnessAt(masked, 20, 20)).toBeLessThan(20)
    expect(await brightnessAt(masked, 80, 80)).toBeGreaterThan(230)
  })

  it('leaves frames untouched when there are no zones', async () => {
    const image = await white()
    expect(await maskPrivacyZones(image, [])).toBe(image)
  })

  it('applies zones only to the camera module they belong to', () => {
    const zones = [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    ]
    const elite = {
      id: 'e',
      name: 'Yard',
      online: true,
      e2eEncrypted: false,
      components: [
        { id: '0', name: 'View 1' },
        { id: '1', name: 'View 2' },
      ],
      privacyZones: zones,
      zonesComponentId: '0',
    } as RingDevice
    expect(zonesFor(elite, '0')).toBe(zones)
    expect(zonesFor(elite, '1')).toEqual([])
    expect(zonesFor({ ...elite, components: undefined, zonesComponentId: undefined }, undefined)).toBe(zones)
  })
})
