import { tileAt } from './iiif.ts'
import type { ImageSource } from './iiif.ts'

export type OverviewImage = {
  url: string
  x: number
  y: number
  width: number
  height: number
}

export function overviewImages(source: ImageSource): OverviewImage[] {
  const { image } = source
  const full = { x: 0, y: 0, width: image.width, height: image.height }
  if (image.supportsAnyRegionAndSize) {
    const request = image.getImageRequest(
      { width: 320, height: 240 },
      'contain'
    )
    if (!Array.isArray(request))
      return [{ ...full, url: image.getImageUrl(request) }]
  }

  // Static IIIF services may advertise only fixed sizes or tiles.
  const size = image.sizes
    ?.filter((size) => size.width * size.height <= 1024 * 1024)
    .sort((a, b) => Math.abs(a.width - 320) - Math.abs(b.width - 320))[0]
  if (size) return [{ ...full, url: image.getImageUrl({ size }) }]

  const level = source.levels[0]
  // A minimap must not fetch an enormous mosaic from an incomplete pyramid.
  if (!level || level.tileCount > 16) return []
  const images: OverviewImage[] = []
  for (let row = 0; row < level.rows; row++) {
    for (let column = 0; column < level.columns; column++) {
      const tile = tileAt(source, level, column, row)
      const [x, y, width, height] = tile.region
      images.push({ url: tile.url, x, y, width, height })
    }
  }
  return images
}

export function overviewFrame(width: number, height: number) {
  const scale = Math.min(164 / width, 116 / height)
  return {
    x: (180 - width * scale) / 2,
    y: (132 - height * scale) / 2,
    width: width * scale,
    height: height * scale,
    scale
  }
}
