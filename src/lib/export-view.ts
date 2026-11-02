import type { Bounds, Point, Scene } from './geometry.ts'
import type { ImageSource, Tile } from './iiif.ts'
import type { FigureVariant, FigurePalette } from './iiif-figure.ts'

export type ExportOptions = {
  area: 'current' | 'overview'
  resolution: number
  overlays: boolean
  transparent: boolean
}

export type ExportView = {
  width: number
  height: number
  center: Point
  scale: number
}

export type PyramidSnapshot = {
  kind?: 'image' | 'pyramid'
  source: ImageSource
  scene: Scene
  view: ExportView
  opacities: Record<string, number>
  grid: boolean
  showPositionFigure: boolean
  figureVariant?: FigureVariant
  figurePalette?: FigurePalette
  viewport?: Bounds
  activeFactor: number
  activeTiles: Tile[]
  selected?: Tile
}

export function exportFrame(
  current: ExportView,
  sceneBounds: Bounds,
  options: Pick<ExportOptions, 'area' | 'resolution'>
) {
  const { area, resolution } = options
  if (![1024, 2048, 4096].includes(resolution))
    throw new Error(
      'Choose an export resolution of 1,024, 2,048 or 4,096 pixels.'
    )
  if (!(current.width > 0 && current.height > 0 && current.scale > 0))
    throw new Error('Wait for the pyramid to finish loading.')

  if (area === 'current') {
    const ratio = resolution / Math.max(current.width, current.height)
    return {
      ...current,
      width: Math.max(1, Math.round(current.width * ratio)),
      height: Math.max(1, Math.round(current.height * ratio)),
      scale: current.scale / ratio,
      decorationScale: ratio
    }
  }

  const [x0, y0, x1, y1] = sceneBounds
  const margin = Math.max(x1 - x0, y1 - y0) * 0.08
  const worldWidth = x1 - x0 + 2 * margin
  const worldHeight = y1 - y0 + 2 * margin
  const ratio = resolution / Math.max(worldWidth, worldHeight)
  const width = Math.max(1, Math.round(worldWidth * ratio))
  const height = Math.max(1, Math.round(worldHeight * ratio))
  return {
    width,
    height,
    center: [(x0 + x1) / 2, (y0 + y1) / 2] as Point,
    scale: Math.max(worldWidth / width, worldHeight / height),
    decorationScale: resolution / 1024
  }
}

export function exportFilename(
  title: string,
  area: ExportOptions['area'],
  width: number,
  height: number
) {
  const name = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return `${name || 'image'}-pyramid-${area}-${width}x${height}.png`
}
