import type { Evented, MapEventType, MapTouchEvent } from 'maplibre-gl'
import type { Point } from './geometry.ts'

export function handleTileTaps(
  map: Evented<MapEventType>,
  enabled: () => boolean,
  select: (point: Point) => void
) {
  // A small finger movement can suppress the browser's compatibility click.
  // Accept a single tap directly, leaving pan and pinch gestures to MapLibre.
  let tapStart: MapTouchEvent | undefined
  const cancelTap = () => (tapStart = undefined)
  map.on('touchstart', (event) => {
    tapStart = enabled() && event.points.length === 1 ? event : undefined
  })
  map.on('touchmove', (event) => {
    if (tapStart && event.point.dist(tapStart.point) > 8) cancelTap()
  })
  map.on('dragstart', cancelTap)
  map.on('zoomstart', cancelTap)
  map.on('touchcancel', cancelTap)
  map.on('touchend', (event) => {
    const start = tapStart
    cancelTap()
    if (
      !start ||
      !enabled() ||
      event.originalEvent.touches.length ||
      event.originalEvent.timeStamp - start.originalEvent.timeStamp > 450 ||
      event.point.dist(start.point) > 8
    )
      return
    event.originalEvent.preventDefault()
    select([event.point.x, event.point.y])
  })
}
