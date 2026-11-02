import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSharedView, shareUrl } from '../src/lib/share-view.ts'
import type { SharedView } from '../src/lib/share-view.ts'

const view: SharedView = {
  image: { center: [18.123456789, -2.987654321], zoom: 18.987654321 },
  pyramid: { center: [-8.765432109, 24.123456789], zoom: 17.654321098 },
  level: 4,
  focusedLevel: 8,
  layout: 'pyramid',
  split: 63,
  tilt: 'left',
  pyramidLayout: 'stacked',
  grid: false,
  figure: true,
  sync: 'none'
}

test('shared links round-trip both independent cameras and settings on any origin', () => {
  for (const base of [
    'http://localhost:4173/',
    'https://example.ngrok.app/pyramid/?url=old#old'
  ]) {
    const source = 'https://example.org/iiif/a%2Fb'
    const url = new URL(shareUrl(base, source, view))
    assert.equal(url.origin, new URL(base).origin)
    assert.equal(url.pathname, new URL(base).pathname)
    assert.equal(url.searchParams.get('url'), source)
    assert.deepEqual(readSharedView(url.hash), view)
  }
})

test('shared views retain adjacent layout and older links default to stacked', () => {
  const state = { ...view, pyramidLayout: 'adjacent' as const }
  const url = new URL(
    shareUrl('https://example.org', 'https://example.org/iiif', state)
  )
  assert.deepEqual(readSharedView(url.hash), state)
  const params = new URLSearchParams(url.hash.slice(1))
  params.delete('arrangement')
  assert.equal(readSharedView(params.toString())?.pyramidLayout, 'stacked')
})

test('camera serialization retains subpixel precision at gigapixel zooms', () => {
  const original = {
    ...view,
    image: {
      center: [18.123456789123, -4.234567891234] as [number, number],
      zoom: 23.123456789123
    }
  }
  const restored = readSharedView(
    new URL(
      shareUrl('https://example.org', 'https://iiif.micr.io/ERwIn', original)
    ).hash
  )!
  for (let i = 0; i < 2; i++)
    assert.ok(
      Math.abs(restored.image.center[i] - original.image.center[i]) < 1e-9
    )
  assert.ok(Math.abs(restored.image.zoom - original.image.zoom) < 1e-9)
})

test('old image-only links and malformed or unsupported views fall back safely', () => {
  for (const hash of ['', '#hello', '#v=2', '#' + 'x'.repeat(3000)])
    assert.equal(readSharedView(hash), undefined)
  const valid = new URL(
    shareUrl('https://example.org', 'https://example.org/iiif', view)
  )
  for (const [key, value] of [
    ['v', '2'],
    ['image', 'NaN,0,2'],
    ['image', ',0,2'],
    ['pyramid', '0,Infinity,2'],
    ['pyramid', '0,0,25'],
    ['image', '0,0,-5'],
    ['image', '10001,0,2'],
    ['image', '0,0,2,4'],
    ['level', '0'],
    ['level', '1.5'],
    ['focus', '-1'],
    ['layout', 'full'],
    ['tilt', 'up'],
    ['arrangement', 'spiral'],
    ['split', '100'],
    ['sync', 'true'],
    ['grid', ''],
    ['figure', 'yes']
  ]) {
    const params = new URLSearchParams(valid.hash.slice(1))
    params.set(key, value)
    assert.equal(
      readSharedView(params.toString()),
      undefined,
      `${key}=${value}`
    )
  }
})

test('all layouts and unset pyramid focus round-trip without adding a focus', () => {
  for (const layout of ['split', 'image', 'pyramid'] as const) {
    const state = {
      ...view,
      layout,
      focusedLevel: undefined,
      sync: 'image-to-pyramid' as const
    }
    assert.deepEqual(
      readSharedView(
        new URL(
          shareUrl('https://example.org', 'https://example.org/iiif', state)
        ).hash
      ),
      state
    )
  }
})

test('shared links preserve supported sync modes and migrate legacy directions', () => {
  for (const sync of ['none', 'image-to-pyramid'] as const) {
    const state = { ...view, sync }
    const url = new URL(
      shareUrl('https://example.org', 'https://example.org/iiif', state)
    )
    assert.deepEqual(readSharedView(url.hash), state)
    const params = new URLSearchParams(url.hash.slice(1))
    params.set('sync', '0')
    assert.equal(readSharedView(params.toString())?.sync, 'none')
    params.set('sync', '1')
    assert.equal(readSharedView(params.toString())?.sync, 'image-to-pyramid')
    params.set('sync', 'both')
    assert.equal(readSharedView(params.toString())?.sync, 'image-to-pyramid')
    params.set('sync', 'pyramid-to-image')
    assert.equal(readSharedView(params.toString())?.sync, 'none')
    params.delete('sync')
    assert.equal(readSharedView(params.toString()), undefined)
  }
})
