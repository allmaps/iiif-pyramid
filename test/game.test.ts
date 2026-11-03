import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageSource, tileAt } from '../src/lib/iiif.ts'
import { chooseTile, nextGameCanvas, scoreGuess } from '../src/lib/game.ts'
import { parseManifest } from '../src/lib/iiif-source.ts'
import { info, manifest3 } from './source-fixtures.ts'

const source = imageSource(info)
const level = source.levels.find((level) => level.scaleFactor === 1)!
const target = tileAt(source, level, 2, 1)
test('manifest rounds visit other canvases before repeating, including across cycles', () => {
  const [a, b] = parseManifest(manifest3()).canvases
  const c = { ...a, id: 'third' }
  const visited = new Set([a.id])
  const draw = (current: string) => {
    const next = nextGameCanvas([a, b, c], current, visited, () => 0.99)!
    visited.add(next.id)
    return next.id
  }
  assert.equal(draw(a.id), c.id)
  assert.equal(draw(c.id), b.id)
  assert.equal(draw(b.id), c.id)
  assert.equal(draw(c.id), b.id)
  assert.equal(draw(b.id), a.id)
  assert.equal(nextGameCanvas([a], a.id, visited), undefined)
})
test('accuracy dominates time; distance, wrong resolution and delay reduce the score', () => {
  assert.equal(scoreGuess(target, target, 0).total, 1000)
  assert.equal(scoreGuess(target, target, 120).total, 800)
  assert.equal(scoreGuess(target, target, 200).total, 800)
  assert.equal(scoreGuess(target, target, 30).total, 950)
  const nearby = tileAt(source, level, 3, 1)
  const far = tileAt(source, level, 7, 3)
  assert.ok(
    scoreGuess(target, nearby, 0).total > scoreGuess(target, far, 0).total
  )
  assert.ok(scoreGuess(target, nearby, 0).total < 800)
  const wrongLevel = {
    ...target,
    key: '2/1/0',
    level: { ...level, scaleFactor: 2 }
  }
  assert.equal(scoreGuess(target, wrongLevel, 0).total, 500)
  assert.equal(scoreGuess(target, target, Infinity).total, 800)
})
test('challenges avoid repeated tiles and tolerate small and one-tile images', () => {
  const used = new Set<string>()
  for (let i = 0; i < 5; i++) {
    const tile = chooseTile(source, used, 'challenging', () => 0)
    assert.ok(!used.has(tile.key))
    assert.ok(tile.level.tileCount >= 4 && tile.level.tileCount <= 4096)
    used.add(tile.key)
  }
  const small = imageSource({
    ...info,
    width: 100,
    height: 100,
    tiles: [{ width: 500, scaleFactors: [1] }]
  })
  assert.equal(chooseTile(small, new Set(['1/0/0'])).key, '1/0/0')
})

test('difficulty reaches finer levels without weighting large levels by their tile count', () => {
  const large = imageSource({
    ...info,
    width: 524288,
    height: 524288,
    tiles: [
      { width: 512, scaleFactors: Array.from({ length: 11 }, (_, i) => 2 ** i) }
    ]
  })
  for (const [difficulty, counts] of [
    ['challenging', [64, 256, 1024, 4096, 16384, 65536]],
    ['expert', [16384, 65536, 262144, 1048576]]
  ] as const) {
    const selected = counts.map((_, i) =>
      chooseTile(large, new Set(), difficulty, () => (i + 0.5) / counts.length)
    )
    assert.deepEqual(
      selected.map((tile) => tile.level.tileCount),
      counts
    )
  }
  assert.equal(
    chooseTile(large, new Set(), 'expert', () => 0.999).level.scaleFactor,
    1
  )
  assert.equal(
    chooseTile(source, new Set(), 'expert', () => 0.999).level.scaleFactor,
    1
  )
})

test('relaxed difficulty favors interior tiles but still allows edges and avoids repeats', () => {
  const square = imageSource({ ...info, width: 4000, height: 4000 })
  const isEdge = (tile: ReturnType<typeof chooseTile>) =>
    tile.column === 0 ||
    tile.row === 0 ||
    tile.column === tile.level.columns - 1 ||
    tile.row === tile.level.rows - 1
  let seed = 12345
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  let edges = 0
  for (let i = 0; i < 1000; i++) {
    const tile = chooseTile(square, new Set(), 'relaxed', random)
    assert.ok(tile.level.tileCount >= 4 && tile.level.tileCount <= 64)
    if (isEdge(tile)) edges++
  }
  assert.ok(edges > 0 && edges < 180, `${edges} edge tiles out of 1000`)
  const used = new Set<string>()
  for (let i = 0; i < 5; i++) {
    const tile = chooseTile(square, used, 'relaxed', () => 0)
    assert.ok(!used.has(tile.key))
    assert.ok(!isEdge(tile))
    used.add(tile.key)
  }
})

test('relaxed panoramas avoid end tiles; tiny pyramids remain playable', () => {
  const panorama = imageSource({
    ...info,
    width: 8000,
    height: 500,
    tiles: [{ width: 500, scaleFactors: [1, 2, 4] }]
  })
  const tile = chooseTile(panorama, new Set(), 'relaxed', () => 0)
  assert.equal(tile.row, 0)
  assert.ok(tile.column > 0 && tile.column < tile.level.columns - 1)
  const tiny = imageSource({
    ...info,
    width: 1000,
    height: 1000,
    tiles: [{ width: 500, scaleFactors: [1] }]
  })
  const used = new Set<string>()
  for (let i = 0; i < 4; i++) {
    const next = chooseTile(tiny, used, 'relaxed', () => 0)
    assert.ok(!used.has(next.key))
    used.add(next.key)
  }
  assert.ok(used.has(chooseTile(tiny, used, 'relaxed', () => 0).key))
})
