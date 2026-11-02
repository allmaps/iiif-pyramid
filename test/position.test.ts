import { test } from 'node:test'
import assert from 'node:assert/strict'
import { figureDropTarget } from '../src/lib/position-marker.ts'
import { isLargePyramid } from '../src/lib/iiif.ts'
import type { Level } from '../src/lib/iiif.ts'
import type { Point } from '../src/lib/geometry.ts'

const levels = (factors: number[]) =>
  factors.map((scaleFactor) => ({ scaleFactor }) as Level)

test('large-pyramid defaults apply only to very large scale ranges, including sparse pyramids', () => {
  assert.equal(isLargePyramid(levels([16, 8, 4, 2, 1])), false)
  assert.equal(isLargePyramid(levels([128, 64, 32, 16, 8, 4, 2, 1])), false)
  assert.equal(
    isLargePyramid(levels([1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1])),
    true
  )
  assert.equal(isLargePyramid(levels([512, 32, 2])), true)
  assert.equal(isLargePyramid(levels([512, 32, 4])), false)
  assert.equal(isLargePyramid(levels([1024])), false)
  assert.equal(isLargePyramid([]), false)
})

test('figure drops pick the frontmost image plane containing the transformed point', () => {
  const points: Point[] = [
    [-1, 80],
    [25, 40],
    [60, 70]
  ]
  const target = figureDropTarget([0, 1, 2], (i) => points[i], 100, 90)
  assert.deepEqual(target, { item: 1, point: [25, 40] })
})

test('figure drops reject off-image and invalid coordinates but include exact image edges', () => {
  const points: Point[] = [
    [101, 40],
    [50, -1],
    [NaN, 25],
    [25, Infinity]
  ]
  assert.equal(
    figureDropTarget(points, (p) => p, 100, 90),
    undefined
  )
  assert.deepEqual(
    figureDropTarget([0], () => [100, 90], 100, 90),
    { item: 0, point: [100, 90] }
  )
})
