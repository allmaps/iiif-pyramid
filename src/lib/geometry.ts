import type { GeoreferencedMap } from '@allmaps/annotation'
import type { ImageSource, Level } from './iiif.ts'
import { virtualServiceUrl } from './virtual-iiif.ts'

export type Point = [number, number]
export type Bounds = [number, number, number, number]
export type TiltDirection = 'left' | 'right'
export type PyramidLayout = 'stacked' | 'adjacent'
export type SceneLayer = {
  id: string
  level: Level
  map: GeoreferencedMap
  corners: Point[]
  label: Point
}
export type Scene = { layers: SceneLayer[]; bounds: Bounds }

export function bounds(points: Point[]): Bounds {
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1]))
  ]
}

export function rectangle([x0, y0, x1, y1]: Bounds): Point[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ]
}

export function createScene(
  source: ImageSource,
  kind: 'image' | 'pyramid',
  origin: string,
  tiltDirection: TiltDirection = 'right',
  layout: PyramidLayout = 'stacked'
): Scene {
  const { width, height } = source.image
  const resource = rectangle([0, 0, width, height])
  const levels = kind === 'image' ? [source.levels.at(-1)!] : source.levels
  const shortSide = Math.min(width, height)
  const longSide = Math.max(width, height)
  // Preserve the familiar stack for ordinary images, then gradually center and
  // tighten it for panoramas. Spacing should follow thickness, not length.
  const elongated = Math.max(0, Math.min(1, (longSide / shortSide - 2) / 2))
  const stackSpacing = longSide * 0.24 * (1 - elongated) + shortSide * elongated
  const alignSide = width > height * 2
  let offset = 0
  const raw = levels.map((level) => {
    const s = level.scaleFactor
    const corners: Point[] = resource.map(([x, y]) => {
      if (kind === 'image') return [x - width / 2, height / 2 - y]
      if (layout === 'adjacent') {
        // Wide panoramas align their left edges and step along the short side.
        // Other images align their top edges. Both arrangements stay disjoint.
        const u = x / s + (alignSide ? 0 : offset),
          v = y / s + (alignSide ? offset : 0)
        return tiltDirection === 'left'
          ? [Math.cos(Math.PI / 6) * (u + v), (u - v) / 2]
          : [Math.cos(Math.PI / 6) * (u - v), -(u + v) / 2]
      }
      return tiltDirection === 'left'
        ? [
            (Math.cos(Math.PI / 6) * (x + y - (width + height) / 2)) / s,
            (x - y - width) / (2 * s) +
              (elongated * (width + height)) / (4 * s) -
              offset
          ]
        : [
            (Math.cos(Math.PI / 6) * (x - y - (width - height) / 2)) / s,
            -(x + y) / (2 * s) +
              (elongated * (width + height)) / (4 * s) -
              offset
          ]
    })
    offset +=
      layout === 'adjacent'
        ? ((alignSide ? height : width) + shortSide * 0.04) / s
        : stackSpacing / s
    return { level, corners }
  })
  const box = bounds(raw.flatMap((layer) => layer.corners))
  const scale =
    (kind === 'image' ? 100 : 130) / Math.max(box[2] - box[0], box[3] - box[1])
  const cx = (box[0] + box[2]) / 2,
    cy = (box[1] + box[3]) / 2
  const layers = raw.map(({ level, corners }): SceneLayer => {
    const points = corners.map(([x, y]): Point => [
      (x - cx) * scale,
      (y - cy) * scale
    ])
    const id = `${kind}-${level.scaleFactor}`
    return {
      id,
      level,
      corners: points,
      label: points.reduce((rightmost, point) =>
        point[0] > rightmost[0] ? point : rightmost
      ),
      map: {
        id,
        type: 'GeoreferencedMap',
        resource: {
          id:
            kind === 'image'
              ? source.url
              : virtualServiceUrl(origin, source.url, level.scaleFactor),
          type: source.info['@id'] ? 'ImageService2' : 'ImageService3',
          width,
          height
        },
        gcps: resource.map((point, i) => ({ resource: point, geo: points[i] })),
        resourceMask: resource,
        transformation: { type: 'polynomial', options: { order: 1 } }
      }
    }
  })
  return { layers, bounds: bounds(layers.flatMap((layer) => layer.corners)) }
}

export function clampViewport(
  points: Point[],
  width: number,
  height: number
): Bounds {
  const b = bounds(points)
  return [
    Math.max(0, Math.min(width, b[0])),
    Math.max(0, Math.min(height, b[1])),
    Math.max(0, Math.min(width, b[2])),
    Math.max(0, Math.min(height, b[3]))
  ]
}
