import { test } from 'node:test'
import assert from 'node:assert/strict'
import { figureFlightPosition } from '../src/lib/figure-flight.ts'
import type { FigureFlight } from '../src/lib/figure-flight.ts'

test('a centered figure rides the camera at any flight progress or zoom', () => {
  const flight: FigureFlight = {
    from: [10, -5],
    to: [200, 80],
    cameraFrom: { center: [10, -5], zoom: 6 },
    cameraTo: { center: [200, 80], zoom: 9 }
  }
  for (const progress of [0, 0.001, 0.15, 0.8, 0.999, 1]) {
    const center: [number, number] = [10 + 190 * progress, -5 + 85 * progress]
    const point = figureFlightPosition(flight, { center, zoom: 2 })
    assert.ok(Math.hypot(point[0] - center[0], point[1] - center[1]) < 1e-10)
  }
})

test('off-center and zoom-only flights begin at the visible figure and land exactly', () => {
  const flight: FigureFlight = {
    from: [5, 8],
    to: [30, 40],
    cameraFrom: { center: [0, 0], zoom: 4 },
    cameraTo: { center: [30, 40], zoom: 8 }
  }
  assert.deepEqual(figureFlightPosition(flight, flight.cameraFrom), flight.from)
  assert.deepEqual(figureFlightPosition(flight, flight.cameraTo), flight.to)
  flight.cameraTo.center = [0, 0]
  assert.deepEqual(
    figureFlightPosition(flight, { center: [0, 0], zoom: 6 }),
    [17.5, 24]
  )
  assert.deepEqual(figureFlightPosition(flight, flight.cameraTo), flight.to)
})
