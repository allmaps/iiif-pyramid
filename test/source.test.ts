import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { serialiseContentState } from '@iiif/helpers/content-state'
import type { ContentState } from '@iiif/helpers/content-state'
import {
  loadIIIFSource,
  parseManifest,
  contentState,
  sourceInput,
  sourceUrl
} from '../src/lib/iiif-source.ts'
import {
  manifestUrl,
  service,
  info,
  canvasId,
  manifest2,
  manifest3
} from './source-fixtures.ts'

const signal = () => new AbortController().signal
const target = (fragment = '') => ({
  id: canvasId(1) + fragment,
  type: 'Canvas',
  partOf: [{ id: manifestUrl, type: 'Manifest' }]
})
const state = (value: unknown) => ({
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  type: 'Annotation',
  motivation: ['contentState'],
  target: value
})

test('Allmaps reads tiled image canvases from Presentation 2 and 3', () => {
  for (const raw of [manifest2(), manifest3()]) {
    const parsed = parseManifest(raw)
    assert.equal(parsed.canvases.length, 2)
    assert.equal(parsed.canvases[1].id, canvasId(1))
    assert.equal(parsed.canvases[1].imageUrl, service)
    assert.equal(parsed.canvases[1].label, 'Page 2')
  }
})

test('the bundled Vermeer manifest opens from a subdirectory and keeps that address in game links', async (t) => {
  const raw = JSON.parse(
    readFileSync(
      new URL('../static/manifests/vermeer.json', import.meta.url),
      'utf8'
    )
  )
  const { canvases, skipped } = parseManifest(raw)
  assert.equal(canvases.length, 36)
  assert.equal(skipped, 0)
  assert.equal(
    new Set(canvases.map((canvas) => canvas.id)).size,
    canvases.length
  )
  const local = 'https://example.org/pyramid/manifests/vermeer.json'
  const canvas = canvases.find(
    (canvas) => canvas.label === 'The Geographer and The Astronomer'
  )!
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    if (String(input) === local) return Response.json(raw)
    assert.equal(String(input), canvas.imageUrl + '/info.json')
    return Response.json({
      ...info,
      id: canvas.imageUrl,
      width: canvas.width,
      height: canvas.height
    })
  })
  const { source } = await loadIIIFSource(local, signal(), {
    canvas: canvas.id
  })
  const link = sourceUrl('https://example.org/pyramid/game/', source)
  assert.equal(link.searchParams.get('iiif-content'), local)
  assert.equal(link.searchParams.get('canvas'), canvas.id)
})

test('manifest, encoded URI, raw/encoded/referenced Content State resolve canvas and scaled spatial region', async (t) => {
  const referenced = 'https://example.org/state.json'
  const annotation = state(target('#xywh=100,200,300,400'))
  const resources: Record<string, unknown> = {
    [manifestUrl]: manifest3(),
    [`${service}/info.json`]: info,
    [referenced]: annotation
  }
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const resource = resources[String(input)]
    assert.ok(resource, `Unexpected fetch ${input}`)
    return Response.json(resource)
  })
  const book = await loadIIIFSource(manifestUrl, signal(), { canvasIndex: '1' })
  assert.equal(book.source.presentation?.canvasId, canvasId(1))
  for (const input of [
    JSON.stringify(annotation),
    serialiseContentState(annotation as ContentState),
    referenced
  ]) {
    const loaded = await loadIIIFSource(input, signal())
    assert.deepEqual(loaded.region, [200, 400, 800, 1200])
    assert.equal(loaded.source.presentation?.canvasId, canvasId(1))
    const restored = await loadIIIFSource(
      contentState(loaded.source, loaded.region)!,
      signal()
    )
    assert.deepEqual(restored.region, loaded.region)
    assert.equal(restored.source.presentation?.canvasId, canvasId(1))
  }
  const encodedUrl = serialiseContentState(
    manifestUrl as unknown as ContentState
  )
  assert.equal(
    (await loadIIIFSource(encodedUrl, signal())).manifest?.url,
    manifestUrl
  )
  const selected = await loadIIIFSource(manifestUrl, signal(), {
    canvas: canvasId(1)
  })
  assert.equal(selected.source.presentation?.canvasId, canvasId(1))
  await assert.rejects(
    loadIIIFSource(manifestUrl, signal(), { canvasIndex: '9' }),
    /requested canvas/
  )
})

test('SpecificResource percent selectors and offset painting rectangles map to image pixels', async (t) => {
  const raw = manifest3()
  raw.items[1].items[0].items[0].target += '#xywh=200,100,1000,500'
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) =>
    Response.json(String(input) === manifestUrl ? raw : info)
  )
  const annotation = state({
    type: 'SpecificResource',
    source: target(),
    selector: {
      type: 'FragmentSelector',
      conformsTo: 'http://www.w3.org/TR/media-frags/',
      value: 'xywh=percent:20,20,20,20'
    }
  })
  const loaded = await loadIIIFSource(JSON.stringify(annotation), signal())
  assert.deepEqual(loaded.region, [800, 400, 2400, 1200])
  assert.deepEqual(
    (
      await loadIIIFSource(
        contentState(loaded.source, loaded.region)!,
        signal()
      )
    ).region,
    loaded.region
  )
})

test('invalid sources fail clearly, aborts are preserved, mixed manifests skip unsupported canvases', async (t) => {
  const raw = manifest3()
  const mixed = {
    ...raw,
    items: [
      ...raw.items,
      {
        id: 'https://example.org/video',
        type: 'Canvas',
        width: 10,
        height: 10,
        items: []
      }
    ]
  }
  assert.equal(parseManifest(mixed).skipped, 1)
  assert.throws(() => parseManifest({ ...raw, items: [] }), /no supported/)
  await assert.rejects(
    loadIIIFSource(
      JSON.stringify({ id: canvasId(0), type: 'Canvas' }),
      signal()
    ),
    /partOf/
  )
  await assert.rejects(loadIIIFSource('{bad', signal()), /valid JSON/)
  await assert.rejects(
    loadIIIFSource(manifestUrl, signal(), { canvasIndex: '-1' }),
    /non-negative/
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(loadIIIFSource(manifestUrl, controller.signal), {
    name: 'AbortError'
  })
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ id: manifestUrl, type: 'Manifest' })
  )
  await assert.rejects(loadIIIFSource(manifestUrl, signal()), /circular/)
  await assert.rejects(
    loadIIIFSource(
      JSON.stringify({ type: 'Collection', id: manifestUrl }),
      signal()
    ),
    /collection or range/
  )
})

test('iiif-content has precedence and source links preserve manifest context', async (t) => {
  assert.equal(
    sourceInput(
      new URLSearchParams({
        'iiif-content': 'state',
        url: 'image',
        manifest: 'manifest'
      })
    ),
    'state'
  )
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) =>
    Response.json(String(input) === manifestUrl ? manifest3() : info)
  )
  const { source } = await loadIIIFSource(manifestUrl, signal(), {
    canvasIndex: '1'
  })
  const url = sourceUrl('https://app.example/?url=old#stale', source, '/game')
  assert.equal(url.pathname, '/game')
  assert.equal(url.searchParams.get('iiif-content'), manifestUrl)
  assert.equal(url.searchParams.get('canvas'), canvasId(1))
  assert.equal(url.hash, '')
  assert.equal(url.searchParams.has('url'), false)
})
