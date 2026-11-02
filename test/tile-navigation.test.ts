import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageSource, tileAt } from '../src/lib/iiif.ts'
import {
  moveTile,
  tileAtPosition,
  tileCenter
} from '../src/lib/tile-navigation.ts'
import { info } from './source-fixtures.ts'

const source = imageSource({ ...info, width: 12550, height: 8550 })
const level = source.levels.at(-1)!

test('arrows move one tile; Shift moves ten; command/control jump to row and column edges', () => {
  const tile = tileAt(source, level, 12, 11)
  assert.equal(moveTile(source, tile, 'ArrowLeft').column, 11)
  assert.equal(moveTile(source, tile, 'ArrowUp', { shiftKey: true }).row, 1)
  assert.equal(
    moveTile(source, tile, 'ArrowRight', { shiftKey: true }).column,
    22
  )
  assert.deepEqual(
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map((key) => {
      const next = moveTile(source, tile, key, { metaKey: true })
      return [next.column, next.row]
    }),
    [
      [0, 11],
      [25, 11],
      [12, 0],
      [12, 17]
    ]
  )
  assert.equal(
    moveTile(source, tile, 'ArrowRight', { ctrlKey: true }).column,
    25
  )
})

test('tile movement clamps without wrapping and preserves the resource position between levels', () => {
  const edge = tileAt(source, level, 25, 17)
  assert.equal(
    moveTile(source, edge, 'ArrowRight', { shiftKey: true }).key,
    edge.key
  )
  assert.equal(moveTile(source, edge, 'ArrowDown').key, edge.key)
  assert.equal(
    tileAtPosition(source, level, [source.image.width, source.image.height])
      .key,
    edge.key
  )
  const coarser = source.levels.find((item) => item.scaleFactor === 2)!
  assert.deepEqual(tileCenter(edge), [12525, 8525])
  const next = tileAtPosition(source, coarser, tileCenter(edge))
  assert.equal(next.column, 12)
  assert.equal(next.row, 8)
  assert.ok(next.region[0] <= tileCenter(edge)[0])
})
