import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WarpedMapList } from '@allmaps/render'
import { lonLatProjection } from '@allmaps/project'
import { loadImage } from '../src/lib/iiif.ts'
import { createScene } from '../src/lib/geometry.ts'
import { sharePreviewSnapshot } from '../src/lib/share-preview-view.ts'
import type { PyramidSnapshot } from '../src/lib/export-view.ts'

test('share close-ups keep the figure centered and tiles readable across scales and tilts', async (t) => {
  for (const [width, height] of [
    [3001, 1803],
    [925000, 775000]
  ]) {
    t.mock.method(globalThis, 'fetch', async () =>
      Response.json({
        '@context': 'http://iiif.io/api/image/3/context.json',
        id: 'https://images.example/image',
        type: 'ImageService3',
        protocol: 'http://iiif.io/api/image',
        profile: 'level2',
        width,
        height,
        tiles: [
          { width: 512, height: 256, scaleFactors: [1, 4, 16, 256, 1024] }
        ]
      })
    )
    const source = await loadImage(
      'https://images.example/image',
      new AbortController().signal
    )
    for (const tilt of ['left', 'right'] as const) {
      const scene = createScene(
        source,
        'pyramid',
        'https://pyramid.example',
        tilt
      )
      const maps = new WarpedMapList({
        projection: lonLatProjection,
        internalProjection: lonLatProjection
      })
      for (const layer of scene.layers) maps.addGeoreferencedMap(layer.map)
      for (const layer of scene.layers) {
        // Off-center, near the image edge, so the crop must follow the figure.
        const snapshot: PyramidSnapshot = {
          source,
          scene,
          view: { width: 800, height: 900, center: [0, 0], scale: 0.1 },
          grid: false,
          showPositionFigure: false,
          viewport: [width * 0.8, height * 0.05, width, height * 0.15],
          activeFactor: layer.level.scaleFactor,
          activeTiles: [],
          opacities: {}
        }
        const preview = sharePreviewSnapshot(snapshot)
        const { view } = preview
        const project = maps
          .getWarpedMap(layer.id)!
          .projectedTransformer.transformToProjectedGeo.bind(
            maps.getWarpedMap(layer.id)!.projectedTransformer
          )
        const feet = project([width * 0.9, height * 0.1])
        const x = view.width / 2 + (feet[0] - view.center[0]) / view.scale
        const y = view.height / 2 - (feet[1] - view.center[1]) / view.scale
        assert.ok(Math.abs(x - view.width / 2) < 0.001)
        assert.ok(Math.abs(y - 23 - view.height / 2) < 0.001)
        const origin = project([0, 0])
        const tileX = project([Math.min(width, 512 * snapshot.activeFactor), 0])
        const tileY = project([
          0,
          Math.min(height, 256 * snapshot.activeFactor)
        ])
        const edge = (point: number[]) =>
          Math.hypot(point[0] - origin[0], point[1] - origin[1]) / view.scale
        assert.ok(Math.abs(Math.min(edge(tileX), edge(tileY)) - 80) < 0.001)
        assert.equal(preview.grid, true)
        assert.equal(preview.showPositionFigure, true)
        assert.deepEqual(
          sharePreviewSnapshot({
            ...snapshot,
            view: { width: 300, height: 200, center: [400, -900], scale: 2 }
          }),
          preview
        )
        assert.equal(snapshot.grid, false)
        assert.equal(snapshot.showPositionFigure, false)
        assert.deepEqual(snapshot.opacities, {})
      }
    }
  }
})
