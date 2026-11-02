import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Image } from '@allmaps/iiif-parser'
import { WarpedMapList } from '@allmaps/render'
import { lonLatProjection } from '@allmaps/project'
import { imageSource, loadImage, tileAt } from '../src/lib/iiif.ts'
import { bounds, createScene } from '../src/lib/geometry.ts'
import type { Point } from '../src/lib/geometry.ts'
import {
  serviceUrl,
  virtualImageInfo,
  virtualServiceUrl,
  parseVirtualRequest
} from '../src/lib/virtual-iiif.ts'
import type { ImageInfo } from '../src/lib/virtual-iiif.ts'

const origin = 'https://pyramid.example'
const sourceUrl = 'https://images.example/iiif/book%2Fpage'
const v3: ImageInfo = {
  '@context': 'http://iiif.io/api/image/3/context.json',
  id: sourceUrl,
  type: 'ImageService3',
  protocol: 'http://iiif.io/api/image',
  profile: 'level2',
  width: 3001,
  height: 1803,
  tiles: [{ width: 512, height: 256, scaleFactors: [1, 2, 4, 8] }]
}
const v2: ImageInfo = {
  ...v3,
  '@context': 'http://iiif.io/api/image/2/context.json',
  '@id': sourceUrl,
  profile: ['http://iiif.io/api/image/2/level2.json']
}
delete v2.id
delete v2.type

for (const [version, info] of [
  ['2', v2],
  ['3', v3]
] as const) {
  test(
    'IIIF ' +
      version +
      ': each virtual service preserves coordinates and caps the finest level',
    () => {
      for (const ceiling of [1, 2, 4, 8]) {
        const id = virtualServiceUrl(origin, sourceUrl, ceiling)
        const virtual = virtualImageInfo(info, id, ceiling)
        const image = Image.parse(virtual)
        assert.equal(image.uri, id)
        assert.equal(image.width, info.width)
        assert.equal(image.height, info.height)
        assert.equal(
          Math.min(...image.tileZoomLevels.map((level) => level.scaleFactor)),
          ceiling
        )
        assert.deepEqual(
          image.tileZoomLevels.map((level) => level.scaleFactor),
          [1, 2, 4, 8].filter((factor) => factor >= ceiling)
        )
        for (const level of image.tileZoomLevels) {
          const tileUrl = image.getImageUrl(
            image.getTileImageRequest(level, level.columns - 1, level.rows - 1)
          )
          const routed = parseVirtualRequest(new URL(tileUrl))!
          const original = Image.parse(info)
          const originalLevel = original.tileZoomLevels.find(
            (candidate) => candidate.scaleFactor === level.scaleFactor
          )!
          const expected = original.getImageUrl(
            original.getTileImageRequest(
              originalLevel,
              level.columns - 1,
              level.rows - 1
            )
          )
          assert.equal(routed.upstream, expected)
          assert.equal(routed.scaleFactor, ceiling)
        }
      }
      assert.deepEqual(info.tiles![0].scaleFactors, [1, 2, 4, 8])
    }
  )
}

test('service routing keeps encoded identifiers intact and rejects invalid namespaces', () => {
  assert.equal(serviceUrl(sourceUrl + '/info.json'), sourceUrl)
  assert.equal(serviceUrl(sourceUrl + '/'), sourceUrl)
  assert.equal(parseVirtualRequest(new URL(origin + '/other')), undefined)
  assert.throws(() => serviceUrl('file:///tmp/image'))
  assert.throws(() => serviceUrl(sourceUrl + '?token=example'))
  assert.throws(() => virtualImageInfo(v3, 'virtual', 16))
  const id = virtualServiceUrl(origin, sourceUrl, 4)
  assert.equal(
    parseVirtualRequest(new URL(id + '/info.json'))!.upstream,
    sourceUrl + '/info.json'
  )
  assert.throws(() => parseVirtualRequest(new URL(id + '/not-a-tile')))
})

test('virtual services stay in their deployment scope and preserve tile requests', () => {
  const source = imageSource(v3)
  const scene = createScene(source, 'pyramid', `${origin}/pyramid`)
  const tile = tileAt(source, source.levels.at(-1)!, 0, 0)
  const requestPath = tile.url.slice(sourceUrl.length)
  for (const item of scene.layers) {
    const url = new URL(item.map.resource.id + requestPath)
    assert.ok(url.pathname.startsWith('/pyramid/__pyramid/iiif/'))
    assert.equal(parseVirtualRequest(url), undefined)
    assert.equal(parseVirtualRequest(url, '/another-app'), undefined)
    const routed = parseVirtualRequest(url, '/pyramid')!
    assert.equal(routed.upstream, tile.url)
    assert.equal(routed.scaleFactor, item.level.scaleFactor)
  }
  const root = new URL(virtualServiceUrl(origin, sourceUrl, 1) + '/info.json')
  assert.equal(parseVirtualRequest(root, '/pyramid'), undefined)
})

test('rectangular edge tiles use exact IIIF region and rounded output dimensions', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(v3))
  const source = await loadImage(sourceUrl, new AbortController().signal)
  assert.deepEqual(
    source.levels.map((level) => level.scaleFactor),
    [8, 4, 2, 1]
  )
  const level = source.levels.find((level) => level.scaleFactor === 2)!
  const tile = tileAt(source, level, level.columns - 1, level.rows - 1)
  assert.deepEqual(tile.region, [2048, 1536, 953, 267])
  assert.deepEqual(tile.size, [477, 134])
  assert.equal(tile.url, sourceUrl + '/2048,1536,953,267/477,134/0/default.jpg')
})

test('Allmaps transformers align all four image corners and invert pixel locations on every plane', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(v3))
  const source = await loadImage(sourceUrl, new AbortController().signal)
  for (const [kind, direction] of [
    ['image', 'left'],
    ['image', 'right'],
    ['pyramid', 'left'],
    ['pyramid', 'right']
  ] as const) {
    const scene = createScene(source, kind, origin, direction)
    const list = new WarpedMapList({
      projection: lonLatProjection,
      internalProjection: lonLatProjection
    })
    list.addImageInfos(
      kind === 'image'
        ? [source.info]
        : scene.layers.map((layer) =>
            virtualImageInfo(
              source.info,
              layer.map.resource.id,
              layer.level.scaleFactor
            )
          )
    )
    for (const layer of scene.layers) {
      list.addGeoreferencedMap(layer.map)
      const warped = list.getWarpedMap(layer.id)!
      for (const [i, gcp] of layer.map.gcps.entries()) {
        const transformed = warped.projectedTransformer.transformToProjectedGeo(
          gcp.resource
        )
        assert.ok(
          Math.hypot(
            transformed[0] - layer.corners[i][0],
            transformed[1] - layer.corners[i][1]
          ) < 1e-6
        )
        assert.ok(Math.abs(transformed[1]) < 90)
      }
      const point: [number, number] = [1731, 821]
      const restored = warped.projectedTransformer.transformToResource(
        warped.projectedTransformer.transformToProjectedGeo(point)
      )
      assert.ok(
        Math.hypot(restored[0] - point[0], restored[1] - point[1]) < 1e-6
      )
    }
    list.clear()
  }
})

test('tilt presets preserve bounds, resolution ceilings and handedness, with labels on the right edge', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(v3))
  const source = await loadImage(sourceUrl, new AbortController().signal)
  const right = createScene(source, 'pyramid', origin)
  const left = createScene(source, 'pyramid', origin, 'left')
  assert.deepEqual(left.bounds, right.bounds)
  assert.deepEqual(
    createScene(source, 'image', origin, 'left'),
    createScene(source, 'image', origin, 'right')
  )
  for (let i = 0; i < left.layers.length; i++) {
    const a = left.layers[i],
      b = right.layers[i]
    assert.deepEqual(bounds(a.corners), bounds(b.corners))
    assert.deepEqual(a.map.resource, b.map.resource)
    assert.equal(a.level.scaleFactor, b.level.scaleFactor)
    // Opposite top-edge slopes, with no reflection of the image contents.
    assert.ok(a.corners[1][1] > a.corners[0][1])
    assert.ok(b.corners[1][1] < b.corners[0][1])
    for (const layer of [a, b]) {
      const [p, x, , y] = layer.corners
      const determinant =
        (x[0] - p[0]) * (y[1] - p[1]) - (x[1] - p[1]) * (y[0] - p[0])
      assert.ok(determinant < 0)
      assert.equal(layer.label[0], Math.max(...layer.corners.map((p) => p[0])))
    }
  }
})

test('adjacent levels stay separate and align their top or side edges to suit the image shape', () => {
  const separated = (a: Point[], b: Point[]) =>
    [...a, ...b].some((point, index) => {
      const polygon = index < a.length ? a : b
      const next = polygon[(index + 1) % polygon.length]
      const axis = [next[1] - point[1], point[0] - next[0]]
      const project = ([x, y]: Point) => x * axis[0] + y * axis[1]
      const first = a.map(project),
        second = b.map(project)
      return (
        Math.max(...first) < Math.min(...second) - 1e-12 ||
        Math.max(...second) < Math.min(...first) - 1e-12
      )
    })
  for (const [width, height] of [
    [4000, 3000],
    [40000, 500],
    [500, 40000],
    [925000, 775000]
  ]) {
    for (const scaleFactors of [
      [1, 2, 4, 8, 16],
      [1, 3, 12, 64, 1024]
    ]) {
      const source = imageSource({
        ...v3,
        width,
        height,
        tiles: [{ width: 512, scaleFactors }]
      })
      for (const tilt of ['left', 'right'] as const) {
        const scene = createScene(source, 'pyramid', origin, tilt, 'adjacent')
        const edge = width > height * 2 ? [0, 3] : [0, 1]
        const [start, end] = edge.map((i) => scene.layers[0].corners[i])
        const axis = [end[0] - start[0], end[1] - start[1]]
        for (let i = 0; i < scene.layers.length; i++) {
          const a = scene.layers[i]
          for (const point of edge.map((i) => a.corners[i])) {
            const distance =
              Math.abs(
                (point[0] - start[0]) * axis[1] -
                  (point[1] - start[1]) * axis[0]
              ) / Math.hypot(...axis)
            assert.ok(distance < 1e-8, `${a.id}: image edge is not aligned`)
          }
          for (const b of scene.layers.slice(i + 1))
            assert.ok(
              separated(a.corners, b.corners),
              `${width}×${height}, ${tilt}: ${a.id} overlaps ${b.id}`
            )
          const finest = scene.layers.at(-1)!
          const edgeLength = (corners: Point[]) =>
            Math.hypot(
              corners[1][0] - corners[0][0],
              corners[1][1] - corners[0][1]
            )
          assert.ok(
            Math.abs(
              edgeLength(a.corners) / edgeLength(finest.corners) -
                finest.level.scaleFactor / a.level.scaleFactor
            ) < 1e-9
          )
        }
      }
    }
  }
})

test('extreme aspect ratios stack within one image thickness', () => {
  for (const [width, height] of [
    [40000, 500],
    [500, 40000]
  ]) {
    const source = imageSource({ ...v3, width, height })
    for (const tilt of ['left', 'right'] as const) {
      const scene = createScene(source, 'pyramid', origin, tilt)
      const centers = scene.layers.map(
        ({ corners }) => (corners[0][1] + corners[2][1]) / 2
      )
      const corners = scene.layers.at(-1)!.corners
      const shortEdge = width > height ? corners[3] : corners[1]
      const thickness = Math.hypot(
        shortEdge[0] - corners[0][0],
        shortEdge[1] - corners[0][1]
      )
      const spread = Math.max(...centers) - Math.min(...centers)
      assert.ok(spread > 0, 'layers must retain their vertical ordering')
      assert.ok(
        spread < thickness,
        'spacing must follow image thickness, not its long side'
      )
    }
  }
})

test('the explorer keeps its centered overlapping stack independently of the game layout', () => {
  const source = imageSource(v3)
  const scene = createScene(source, 'pyramid', origin)
  for (const item of scene.layers) {
    const box = bounds(item.corners)
    assert.ok(Math.abs((box[0] + box[2]) / 2) < 1e-9)
  }
  for (let i = 1; i < scene.layers.length; i++) {
    const upper = bounds(scene.layers[i - 1].corners)
    const lower = bounds(scene.layers[i].corners)
    assert.ok(
      lower[3] > upper[1],
      'stacked layers must still overlap vertically'
    )
  }
  assert.notDeepEqual(
    scene,
    createScene(source, 'pyramid', origin, 'right', 'adjacent')
  )
})
