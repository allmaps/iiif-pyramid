import { test } from 'node:test'
import assert from 'node:assert/strict'
import { figurePalettes, iiifFigureParts } from '../src/lib/iiif-figure.ts'
import type { FigurePart } from '../src/lib/iiif-figure.ts'

const project = (part: FigurePart, x: number, y: number) => {
  const [a, b, c, d, e, f] = part.matrix
  return [a * x + c * y + e, b * x + d * y + f]
}

test('both IIIF poses spread the dotted feet and lift both f arms on drag', () => {
  for (const variant of ['iiif', 'iiif-open'] as const) {
    const rest = iiifFigureParts(variant, 'iiif')
    const held = iiifFigureParts(variant, 'iiif', 1)
    const feetApart = (parts: FigurePart[]) =>
      Math.abs(
        project(parts[0], 55, 89.32)[0] - project(parts[1], 55, 89.32)[0]
      )
    assert.ok(feetApart(held) > feetApart(rest) * 1.4)
    for (const [index, x, y] of [
      [2, 411.795, 441.32],
      [3, 493.37, 0]
    ])
      assert.ok(
        project(held[index], x, y)[1] < project(rest[index], x, y)[1] - 3
      )
    assert.deepEqual(
      held[4],
      rest[4],
      'the body does not distort during the jumping-jack motion'
    )
    for (const t of [0, 0.25, 0.5, 0.75, 1])
      for (const part of iiifFigureParts(variant, 'iiif', t))
        assert.ok(part.matrix.every(Number.isFinite))
  }
})

test('palette changes preserve geometry and the original IIIF colors', () => {
  assert.deepEqual(figurePalettes.iiif, {
    primary: '#ed1d33',
    secondary: '#2873ab'
  })
  for (const t of [0, 0.5, 1]) {
    const original = iiifFigureParts('iiif', 'iiif', t)
    const app = iiifFigureParts('iiif', 'app', t)
    assert.deepEqual(
      original.map(({ color, ...part }) => part),
      app.map(({ color, ...part }) => part)
    )
    assert.equal(original[0].color, figurePalettes.iiif.secondary)
    assert.equal(app[0].color, figurePalettes.app.secondary)
    assert.equal(original[4].color, figurePalettes.iiif.primary)
  }
})
