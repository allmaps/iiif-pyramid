import { tileAt } from './iiif.ts'
import type { ImageSource, Level, Tile } from './iiif.ts'
import type { Point } from './geometry.ts'

export function tileCenter(tile: Tile): Point {
  const [x, y, width, height] = tile.region
  return [x + width / 2, y + height / 2]
}

export function tileAtPosition(
  source: ImageSource,
  level: Level,
  point: Point
) {
  return tileAt(
    source,
    level,
    Math.max(
      0,
      Math.min(
        level.columns - 1,
        Math.floor(point[0] / (level.tileWidth * level.scaleFactor))
      )
    ),
    Math.max(
      0,
      Math.min(
        level.rows - 1,
        Math.floor(point[1] / (level.tileHeight * level.scaleFactor))
      )
    )
  )
}

/** Keep navigation inside the row/column, including partial tiles at the edge. */
export function moveTile(
  source: ImageSource,
  tile: Tile,
  key: string,
  { shiftKey = false, metaKey = false, ctrlKey = false } = {}
): Tile {
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight'
  const direction = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1
  const end = (horizontal ? tile.level.columns : tile.level.rows) - 1
  const current = horizontal ? tile.column : tile.row
  const next =
    metaKey || ctrlKey
      ? direction < 0
        ? 0
        : end
      : Math.max(0, Math.min(end, current + direction * (shiftKey ? 10 : 1)))
  return tileAt(
    source,
    tile.level,
    horizontal ? next : tile.column,
    horizontal ? tile.row : next
  )
}
