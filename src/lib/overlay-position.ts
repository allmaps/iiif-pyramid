export type Rect = { x: number; y: number; width: number; height: number }

/** Find the nearest position that clears the visible canvas controls. */
export function overlayPosition(
  desired: [number, number],
  panel: { width: number; height: number },
  canvas: { width: number; height: number },
  obstacles: Rect[],
  gap = 12
): [number, number] {
  const maxX = Math.max(gap, canvas.width - panel.width - gap)
  const maxY = Math.max(gap, canvas.height - panel.height - gap)
  const clampX = (x: number) => Math.max(gap, Math.min(maxX, x))
  const clampY = (y: number) => Math.max(gap, Math.min(maxY, y))
  const x = clampX(desired[0]),
    y = clampY(desired[1])
  const xs = new Set([x, gap, maxX])
  const ys = new Set([y, gap, maxY])
  for (const rect of obstacles) {
    xs.add(clampX(rect.x - panel.width - gap))
    xs.add(clampX(rect.x + rect.width + gap))
    ys.add(clampY(rect.y - panel.height - gap))
    ys.add(clampY(rect.y + rect.height + gap))
  }
  let best: [number, number] = [x, y]
  let score = Infinity
  for (const px of xs)
    for (const py of ys) {
      const overlap = obstacles.reduce(
        (area, rect) =>
          area +
          Math.max(
            0,
            Math.min(px + panel.width, rect.x + rect.width + gap) -
              Math.max(px, rect.x - gap)
          ) *
            Math.max(
              0,
              Math.min(py + panel.height, rect.y + rect.height + gap) -
                Math.max(py, rect.y - gap)
            ),
        0
      )
      const next =
        overlap * (canvas.width ** 2 + canvas.height ** 2) +
        (px - x) ** 2 +
        (py - y) ** 2
      if (next < score) {
        score = next
        best = [px, py]
      }
    }
  return best
}
