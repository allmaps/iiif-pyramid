import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fitPadding } from '../src/lib/fit-padding.ts'

test('canvas 17 clears both rows of controls in a split image panel', () => {
  const pad = fitPadding(
    640,
    720,
    4863 / 5703,
    [
      [8, 8, 760, 48],
      [492, 656, 618, 698]
    ],
    48
  )
  assert.equal(pad.top, 60)
  assert.equal(pad.bottom, 76)
  assert.ok(Math.abs(pad.left - pad.right) < 1e-9)
})

test('a portrait fits beside a floating view and a panorama fits above it', () => {
  const inset: [number, number, number, number] = [670, 340, 980, 580]
  const portrait = fitPadding(1000, 600, 0.75, [inset], 48)
  assert.equal(portrait.top, 48)
  assert.equal(portrait.bottom, 48)
  assert.ok(1000 - portrait.right <= inset[0] - 12)
  const panorama = fitPadding(1000, 600, 5, [inset], 48)
  assert.equal(panorama.left, 48)
  assert.equal(panorama.right, 48)
  assert.ok(600 - panorama.bottom <= inset[1] - 12)
})
