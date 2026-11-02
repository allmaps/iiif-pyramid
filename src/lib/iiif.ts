import { Image } from '@allmaps/iiif-parser'
import { serviceUrl } from './virtual-iiif.ts'
import type { ImageInfo } from './virtual-iiif.ts'

export type Level = {
  index: number
  scaleFactor: number
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  columns: number
  rows: number
  tileCount: number
}
export type ImageSource = {
  url: string
  info: ImageInfo
  image: Image
  title: string
  levels: Level[]
  presentation?: {
    manifestUrl: string
    manifestLabel: string
    canvasId: string
    canvasLabel: string
    canvasWidth: number
    canvasHeight: number
    // Painting rectangle in canvas coordinates (not image pixels).
    imageBounds: [number, number, number, number]
  }
}
export type Tile = {
  key: string
  level: Level
  column: number
  row: number
  region: [number, number, number, number]
  size: [number, number]
  url: string
}

export function isLargePyramid(levels: Level[]) {
  return (
    levels.length > 1 &&
    levels[0].scaleFactor / levels[levels.length - 1].scaleFactor >= 256
  )
}

export const examples = [
  {
    title: 'The Night Watch',
    collection: 'Rijksmuseum',
    url: 'https://iiif.micr.io/hsdOg'
  },
  {
    title: 'The Night Watch · 717 gigapixels',
    collection: 'Rijksmuseum',
    url: 'https://iiif.micr.io/ERwIn'
  },
  {
    title: 'Panorama Mesdag',
    collection: 'Museum Panorama Mesdag',
    url: 'https://iiif.micr.io/thptR'
  },
  {
    title: 'Van Berckenrodekaart',
    collection: 'University of Amsterdam',
    url: 'https://amsterdamtimemachine.github.io/berckenrode-iiif/KZL_W_X_020'
  },
  {
    title: 'Railway bridge Hollands Diep',
    collection: 'TU Delft',
    url: 'https://dlc.services/iiif-img/7/18/8e152582-1053-43db-8530-1e767e583b1f'
  },
  {
    title: 'Decorated book binding',
    collection: 'Princeton University Library',
    url: 'https://iiif.princeton.edu/loris/pudl0001%2F4609321%2Fs42%2F00000001.jp2'
  }
]

export async function loadImage(
  value: string,
  signal: AbortSignal
): Promise<ImageSource> {
  const requested = serviceUrl(value)
  const response = await fetch(`${requested}/info.json`, { signal })
  if (!response.ok)
    throw new Error(`The image service returned HTTP ${response.status}.`)
  const info = (await response.json()) as ImageInfo
  return imageSource(info, requested)
}

export function imageSource(info: ImageInfo, requested?: string): ImageSource {
  const image = Image.parse(info)
  const url = serviceUrl(image.uri)
  // The parser supplies supported tilesets for services with arbitrary regions.
  // Persist those in the virtual services too; never invent finer source levels.
  const zoomLevels = image.tileZoomLevels
  if (!zoomLevels.length)
    throw new Error('This image service does not provide tiles.')
  const levels = [...new Set(zoomLevels.map((level) => level.scaleFactor))]
    .sort((a, b) => b - a)
    .map((scaleFactor, index): Level => {
      const tile = zoomLevels
        .filter((level) => level.scaleFactor === scaleFactor)
        .sort((a, b) => b.width * b.height - a.width * a.height)[0]
      return {
        index,
        scaleFactor,
        width: Math.ceil(image.width / scaleFactor),
        height: Math.ceil(image.height / scaleFactor),
        tileWidth: tile.width,
        tileHeight: tile.height,
        columns: tile.columns,
        rows: tile.rows,
        tileCount: tile.columns * tile.rows
      }
    })
  return {
    url,
    image,
    info: {
      ...info,
      tiles: levels.map((level) => ({
        width: level.tileWidth,
        height: level.tileHeight,
        scaleFactors: [level.scaleFactor]
      }))
    },
    title:
      examples.find(
        (example) => example.url === url || example.url === requested
      )?.title ?? new URL(url).hostname,
    levels
  }
}

export function tileAt(
  source: ImageSource,
  level: Level,
  column: number,
  row: number
): Tile {
  const zoom = source.image.tileZoomLevels.find(
    (tile) =>
      tile.scaleFactor === level.scaleFactor &&
      tile.width === level.tileWidth &&
      tile.height === level.tileHeight
  )!
  const request = source.image.getTileImageRequest(zoom, column, row)
  const { region, size } = request
  if (
    !region ||
    !size ||
    typeof region !== 'object' ||
    typeof size !== 'object'
  )
    throw new Error('Invalid tile dimensions.')
  return {
    key: `${level.scaleFactor}/${column}/${row}`,
    level,
    column,
    row,
    region: [region.x, region.y, region.width, region.height],
    size: [size.width!, size.height!],
    url: source.image.getImageUrl(request)
  }
}
