import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadImage } from '../src/lib/iiif.ts'
import { overviewFrame, overviewImages } from '../src/lib/image-overview.ts'

const url = 'https://images.example/iiif/overview'
const info = {
  '@context': 'http://iiif.io/api/image/3/context.json',
  id: url,
  type: 'ImageService3',
  protocol: 'http://iiif.io/api/image',
  profile: 'level2',
  width: 3001,
  height: 1803,
  tiles: [{ width: 512, height: 256, scaleFactors: [1, 2] }]
}

test('image overview fits portrait, landscape and very narrow images without clipping', () => {
  for (const [width, height] of [
    [3001, 1803],
    [1803, 3001],
    [1, 10000],
    [10000, 1]
  ]) {
    const frame = overviewFrame(width, height)
    assert.ok(frame.x >= 8 && frame.y >= 8)
    assert.ok(frame.x + frame.width <= 172)
    assert.ok(frame.y + frame.height <= 124)
    assert.equal(frame.x + frame.width / 2, 90)
    assert.equal(frame.y + frame.height / 2, 66)
    assert.ok(Math.abs(frame.width / frame.height - width / height) < 1e-8)
  }
})

test('dynamic IIIF services use one small full-image overview request', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(info))
  const source = await loadImage(url, new AbortController().signal)
  assert.deepEqual(overviewImages(source), [
    {
      url: url + '/full/320,192/0/default.jpg',
      x: 0,
      y: 0,
      width: 3001,
      height: 1803
    }
  ])
})

test('tile-only IIIF overviews align rectangular edge tiles in source coordinates', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...info, profile: 'level0' })
  )
  const source = await loadImage(url, new AbortController().signal)
  const images = overviewImages(source)
  assert.equal(images.length, 12)
  assert.equal(
    images.reduce((area, tile) => area + tile.width * tile.height, 0),
    info.width * info.height
  )
  assert.deepEqual(images.at(-1), {
    url: url + '/2048,1536,953,267/477,134/0/default.jpg',
    x: 2048,
    y: 1536,
    width: 953,
    height: 267
  })
})

test('static overviews prefer advertised sizes and never fetch a huge tile mosaic', async (t) => {
  const sparse = {
    ...info,
    profile: 'level0',
    tiles: [{ width: 512, height: 256, scaleFactors: [1] }]
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json(sparse))
  const source = await loadImage(url, new AbortController().signal)
  assert.deepEqual(overviewImages(source), [])
  source.image.sizes = [{ width: 300, height: 180 }]
  assert.equal(
    overviewImages(source)[0].url,
    url + '/full/300,180/0/default.jpg'
  )
})
