import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Evented, Point } from 'maplibre-gl'
import type { MapEventType } from 'maplibre-gl'
import { handleTileTaps } from '../src/lib/tile-taps.ts'

class TouchMap extends Evented<MapEventType> {}

test('a game tap selects once and consumes the compatibility click', () => {
  const map = new TouchMap()
  const selections: number[][] = []
  let prevented = 0
  let guessing = true
  handleTileTaps(
    map,
    () => guessing,
    (point) => selections.push(point)
  )
  function touch(
    type: 'touchstart' | 'touchmove' | 'touchend',
    x: number,
    time: number,
    fingers = 1
  ) {
    const point = new Point(x, 100)
    map.fire(type, {
      point,
      points: Array(fingers).fill(point),
      originalEvent: {
        touches: { length: type === 'touchend' ? 0 : fingers },
        timeStamp: time,
        preventDefault: () => prevented++
      }
    })
  }

  touch('touchstart', 200, 0)
  touch('touchmove', 202, 30)
  touch('touchend', 203, 80)
  touch('touchend', 203, 90)
  assert.deepEqual(selections, [[203, 100]])
  assert.equal(prevented, 1)

  // Panning back to the starting point, pinching, a long press, cancellation
  // and a tap finishing after the reveal must leave the guess alone.
  touch('touchstart', 200, 100)
  touch('touchmove', 225, 120)
  touch('touchend', 200, 180)
  touch('touchstart', 200, 200)
  touch('touchstart', 204, 210, 2)
  touch('touchend', 200, 260)
  touch('touchstart', 200, 300)
  touch('touchend', 200, 1000)
  for (const type of ['dragstart', 'zoomstart', 'touchcancel'] as const) {
    touch('touchstart', 200, 1100)
    map.fire(type)
    touch('touchend', 200, 1150)
  }
  touch('touchstart', 200, 1200)
  guessing = false
  touch('touchend', 200, 1230)
  assert.deepEqual(selections, [[203, 100]])
  assert.equal(prevented, 1)
})
