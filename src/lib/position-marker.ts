import type { Bounds, Point } from './geometry.ts'
import { figurePalettes, iiifFigureParts } from './iiif-figure.ts'
import type { FigureOptions } from './iiif-figure.ts'

// The figure is drawn in screen space, with its feet at the resource position.
// Share the shape between the live SVG and PNG exports.
export const figureBody = 'M-5-30Q0-33 5-30L6-17Q0-14-6-17Z'
export const figureLimbs = 'M-5-28L-10-19M5-28L10-19M-3-17L-4-5M3-17L4-5'
export const figureDraggingLimbs =
  'M-5-28L-15-39M5-28L15-39M-3-17L-13-4M3-17L13-4'

/** Layers are ordered front to back, just as they are drawn in the pyramid. */
export function figureDropTarget<T>(
  items: T[],
  toResource: (item: T) => Point,
  width: number,
  height: number
): { item: T; point: Point } | undefined {
  for (const item of items) {
    const [x, y] = toResource(item)
    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 0 &&
      y >= 0 &&
      x <= width &&
      y <= height
    )
      return { item, point: [x, y] }
  }
}

export function viewportCenter(viewport?: Bounds): Point | undefined {
  if (!viewport || viewport[2] <= viewport[0] || viewport[3] <= viewport[1])
    return
  return [(viewport[0] + viewport[2]) / 2, (viewport[1] + viewport[3]) / 2]
}

export function positionVisible(
  [x, y]: Point,
  width: number,
  height: number,
  scale = 1
) {
  return (
    x >= 22 * scale &&
    x <= width - 22 * scale &&
    y >= 54 * scale &&
    y <= height - 6 * scale
  )
}

export function drawPositionFigure(
  context: CanvasRenderingContext2D,
  point: Point,
  scale: number,
  {
    variant = 'iiif',
    palette = 'iiif',
    shadow = true
  }: FigureOptions & { shadow?: boolean } = {}
) {
  const colors = figurePalettes[palette]
  context.save()
  context.translate(...point)
  context.scale(scale, scale)
  context.globalAlpha = 1
  context.lineCap = context.lineJoin = 'round'
  if (shadow) {
    context.beginPath()
    context.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2)
    context.fillStyle = `${colors.primary}40`
    context.fill()
    context.strokeStyle = '#fff'
    context.lineWidth = 4
    context.stroke()
    context.strokeStyle = colors.primary
    context.lineWidth = 1.5
    context.stroke()
  }
  if (variant !== 'original') {
    for (const part of iiifFigureParts(variant, palette)) {
      context.save()
      context.transform(...part.matrix)
      const path = new Path2D(part.path)
      context.strokeStyle = '#fff'
      context.lineWidth = part.outline
      context.stroke(path)
      context.fillStyle = part.color
      context.fill(path)
      context.restore()
    }
    context.restore()
    return
  }
  const limbs = new Path2D(figureLimbs)
  context.strokeStyle = '#fff'
  context.lineWidth = 8
  context.stroke(limbs)
  context.strokeStyle = palette === 'app' ? colors.primary : colors.secondary
  context.lineWidth = 5
  context.stroke(limbs)
  const body = new Path2D(figureBody)
  context.strokeStyle = '#fff'
  context.lineWidth = 3
  context.stroke(body)
  context.fillStyle = colors.primary
  context.fill(body)
  context.beginPath()
  context.arc(0, -41, 5.5, 0, Math.PI * 2)
  context.stroke()
  context.fill()
  context.restore()
}
