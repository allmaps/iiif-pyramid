import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overlayPosition } from '../src/lib/overlay-position.ts'
import type { Rect } from '../src/lib/overlay-position.ts'

test('overlays clear top and bottom controls even at the canvas corners', () => {
  const canvas = { width: 1280, height: 720 }
  const panel = { width: 320, height: 260 }
  const controls: Rect[] = [
    { x: 8, y: 8, width: 440, height: 40 },
    { x: 950, y: 8, width: 322, height: 40 },
    { x: 1050, y: 660, width: 210, height: 40 },
    { x: 460, y: 640, width: 360, height: 56 }
  ]
  for (const desired of [
    [0, 0],
    [1280, 0],
    [1280, 720],
    [500, 720],
    [500, 100]
  ] as [number, number][]) {
    const [x, y] = overlayPosition(desired, panel, canvas, controls)
    assert.ok(x >= 12 && y >= 12)
    assert.ok(x + panel.width <= canvas.width - 12)
    assert.ok(y + panel.height <= canvas.height - 12)
    for (const rect of controls)
      assert.ok(
        x + panel.width <= rect.x - 12 ||
          x >= rect.x + rect.width + 12 ||
          y + panel.height <= rect.y - 12 ||
          y >= rect.y + rect.height + 12
      )
  }
  assert.deepEqual(
    overlayPosition([500, 100], panel, canvas, controls),
    [500, 100]
  )
})

test('mobile overlays avoid the vertical zoom controls and bottom submit row', () => {
  const [x, y] = overlayPosition(
    [390, 844],
    { width: 140, height: 176 },
    { width: 390, height: 844 },
    [
      { x: 8, y: 8, width: 374, height: 40 },
      { x: 340, y: 60, width: 42, height: 168 },
      { x: 48, y: 780, width: 294, height: 52 }
    ]
  )
  assert.ok(x + 140 <= 378)
  assert.ok(y + 176 <= 768)
})
