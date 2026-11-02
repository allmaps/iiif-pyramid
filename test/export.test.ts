import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportFrame, exportFilename } from '../src/lib/export-view.ts'
import type { ExportView } from '../src/lib/export-view.ts'

const current: ExportView = {
  width: 631,
  height: 577,
  center: [18, -12],
  scale: 0.027
}
const bounds: [number, number, number, number] = [-65, -48, 65, 48]

test('current-view exports preserve center and visible extent across resolutions and aspect ratios', () => {
  for (const resolution of [1024, 2048, 4096]) {
    for (const view of [current, { ...current, width: 300, height: 700 }]) {
      const frame = exportFrame(view, bounds, { area: 'current', resolution })
      assert.equal(Math.max(frame.width, frame.height), resolution)
      assert.deepEqual(frame.center, view.center)
      assert.ok(
        Math.abs(frame.width * frame.scale - view.width * view.scale) <=
          frame.scale
      )
      assert.ok(
        Math.abs(frame.height * frame.scale - view.height * view.scale) <=
          frame.scale
      )
    }
  }
})

test('overview exports fit every scene edge with a margin independently of the live camera', () => {
  const frame = exportFrame(current, bounds, {
    area: 'overview',
    resolution: 2048
  })
  const moved = exportFrame(
    { ...current, center: [900, 700], scale: 0.001 },
    bounds,
    { area: 'overview', resolution: 2048 }
  )
  assert.deepEqual(frame, moved)
  assert.deepEqual(frame.center, [0, 0])
  assert.equal(Math.max(frame.width, frame.height), 2048)
  assert.ok(frame.width * frame.scale > bounds[2] - bounds[0])
  assert.ok(frame.height * frame.scale > bounds[3] - bounds[1])
})

test('export sizes are bounded and filenames describe the saved image', () => {
  for (const resolution of [0, -1, 8192, NaN, Infinity])
    assert.throws(() =>
      exportFrame(current, bounds, { area: 'current', resolution })
    )
  assert.throws(() =>
    exportFrame({ ...current, width: 0 }, bounds, {
      area: 'current',
      resolution: 1024
    })
  )
  assert.equal(
    exportFilename('Delft / Étude', 'overview', 2048, 1600),
    'delft-etude-pyramid-overview-2048x1600.png'
  )
})
