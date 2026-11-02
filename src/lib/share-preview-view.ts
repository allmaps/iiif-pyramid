import { viewportCenter } from './position-marker.ts'
import type { Point } from './geometry.ts'
import type { PyramidSnapshot } from './export-view.ts'

/** Frame the position and a handful of tiles, independently of either live camera. */
export function sharePreviewSnapshot(
  snapshot: PyramidSnapshot
): PyramidSnapshot {
  const position = viewportCenter(snapshot.viewport)
  const active = snapshot.scene.layers.find(
    (item) => item.level.scaleFactor === snapshot.activeFactor
  )
  if (!position || !active)
    throw new Error('Bring the image into view, then retry the preview.')

  const { width, height } = snapshot.source.image
  const [origin, right, , bottom] = active.corners
  const xAxis: Point = [right[0] - origin[0], right[1] - origin[1]]
  const yAxis: Point = [bottom[0] - origin[0], bottom[1] - origin[1]]
  // Pyramid planes are affine: the same corners also define their Allmaps GCPs.
  const world: Point = [
    origin[0] +
      (xAxis[0] * position[0]) / width +
      (yAxis[0] * position[1]) / height,
    origin[1] +
      (xAxis[1] * position[0]) / width +
      (yAxis[1] * position[1]) / height
  ]
  const { level } = active
  const tileWidth =
    (Math.hypot(...xAxis) *
      Math.min(width, level.tileWidth * level.scaleFactor)) /
    width
  const tileHeight =
    (Math.hypot(...yAxis) *
      Math.min(height, level.tileHeight * level.scaleFactor)) /
    height
  // The card doubles these logical pixels: tile edges are at least 160 px,
  // and the figure is 92 px tall. Keep its body, rather than its feet, centered.
  const scale = Math.min(tileWidth, tileHeight) / 80
  return {
    ...snapshot,
    kind: 'pyramid',
    view: {
      width: 600,
      height: 315,
      center: [world[0], world[1] + 23 * scale],
      scale
    },
    grid: true,
    showPositionFigure: true,
    selected: undefined,
    opacities: Object.fromEntries(
      snapshot.scene.layers.map((item) => [
        item.id,
        item.level.scaleFactor > snapshot.activeFactor ? 0.18 : 1
      ])
    )
  }
}
