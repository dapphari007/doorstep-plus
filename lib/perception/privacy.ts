// Ring privacy zones: areas the owner asked never to be seen. Blacked out before any frame
// reaches the model or storage.

import sharp from 'sharp'

/** Polygon in Ring's normalized coordinates: (0, 0) top-left, (1, 1) bottom-right. */
export type Zone = { x: number; y: number }[]

export async function maskPrivacyZones(image: Buffer, zones: Zone[]): Promise<Buffer> {
  const usable = zones.filter((z) => z.length >= 3)
  if (!usable.length || !image.length) return image
  const { width, height, format } = await sharp(image).metadata()
  if (!width || !height) return image
  const polygons = usable
    .map((z) => `<polygon points="${z.map((p) => `${p.x * width},${p.y * height}`).join(' ')}" fill="black"/>`)
    .join('')
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${polygons}</svg>`,
  )
  const out = sharp(image).composite([{ input: svg, top: 0, left: 0 }])
  return format === 'png' ? out.png().toBuffer() : out.jpeg({ quality: 90 }).toBuffer()
}
