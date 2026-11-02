import type { Point } from './geometry.ts'
import type { CameraPosition } from './share-view.ts'

export type FigureFlight = {
  from: Point
  to: Point
  cameraFrom: CameraPosition
  cameraTo: CameraPosition
}

/** Follow the camera's actual ground path, including flyTo's changing zoom. */
export function figureFlightPosition(
  flight: FigureFlight,
  camera: CameraPosition
): Point {
  const dx = flight.cameraTo.center[0] - flight.cameraFrom.center[0]
  const dy = flight.cameraTo.center[1] - flight.cameraFrom.center[1]
  const distance = dx * dx + dy * dy
  const zoom = flight.cameraTo.zoom - flight.cameraFrom.zoom
  const progress = Math.max(
    0,
    Math.min(
      1,
      distance > 1e-18
        ? ((camera.center[0] - flight.cameraFrom.center[0]) * dx +
            (camera.center[1] - flight.cameraFrom.center[1]) * dy) /
            distance
        : Math.abs(zoom) > 1e-10
          ? (camera.zoom - flight.cameraFrom.zoom) / zoom
          : 1
    )
  )
  return [
    flight.from[0] + (flight.to[0] - flight.from[0]) * progress,
    flight.from[1] + (flight.to[1] - flight.from[1]) * progress
  ]
}
