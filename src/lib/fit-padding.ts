import type { Bounds } from './geometry.ts'

/** Fit the target in the largest available space for its aspect ratio. */
export function fitPadding(
  width: number,
  height: number,
  aspect: number,
  obstacles: Bounds[],
  margin: number
) {
  const edge = Math.min(margin, width / 8, height / 8)
  const right = width - edge
  const bottom = height - edge
  const gap = 12
  const blocked = obstacles
    .map(([x0, y0, x1, y1]): Bounds => [
      Math.max(edge, x0 - gap),
      Math.max(edge, y0 - gap),
      Math.min(right, x1 + gap),
      Math.min(bottom, y1 + gap)
    ])
    .filter(([x0, y0, x1, y1]) => x0 < x1 && y0 < y1)
    .sort((a, b) => a[1] - b[1])
  let bestHeight = 0
  let bestDistance = Infinity
  let padding = { top: edge, right: edge, bottom: edge, left: edge }

  function consider(left: number, top: number, endX: number, endY: number) {
    const h = Math.min((endX - left) / aspect, endY - top)
    if (h <= 0 || h < bestHeight) return
    const w = h * aspect
    const x = Math.max(left, Math.min((width - w) / 2, endX - w))
    const y = Math.max(top, Math.min((height - h) / 2, endY - h))
    const distance = Math.hypot(x + w / 2 - width / 2, y + h / 2 - height / 2)
    if (h === bestHeight && distance >= bestDistance) return
    bestHeight = h
    bestDistance = distance
    padding = { top: y, right: width - x - w, bottom: height - y - h, left: x }
  }

  // A maximal empty rectangle ends at a panel edge or a control. For each
  // pair of horizontal limits, try the vertical gaps between the controls.
  for (const left of [edge, ...blocked.map((box) => box[2])]) {
    for (const endX of [right, ...blocked.map((box) => box[0])]) {
      if (endX <= left) continue
      let top = edge
      for (const [x0, y0, x1, y1] of blocked) {
        if (x0 >= endX || x1 <= left) continue
        consider(left, top, endX, y0)
        top = Math.max(top, y1)
      }
      consider(left, top, endX, bottom)
    }
  }
  return padding
}
