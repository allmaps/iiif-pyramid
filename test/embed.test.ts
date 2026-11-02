import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageSource } from '../src/lib/iiif.ts'
import {
  defaultEmbedOptions,
  embedUrl,
  embedCode,
  readEmbedOptions
} from '../src/lib/embed-options.ts'
import { info } from './source-fixtures.ts'
test('embed options round-trip and invalid enums fall back safely', () => {
  const options = {
    ...defaultEmbedOptions,
    layout: 'pyramid' as const,
    header: true,
    controls: false,
    scrollZoom: true,
    tilt: 'left' as const,
    pyramidLayout: 'adjacent' as const
  }
  const url = new URL(
    embedUrl('https://app.example/?url=old#old', imageSource(info), options)
  )
  assert.equal(url.pathname, '/embed/')
  assert.equal(url.hash, '')
  assert.equal(url.searchParams.get('url'), info.id)
  assert.deepEqual(readEmbedOptions(url.searchParams), options)
  assert.deepEqual(
    readEmbedOptions(new URLSearchParams('layout=bad&tilt=bad')),
    defaultEmbedOptions
  )
})
test('iframe code escapes attributes and bounds frame height', () => {
  const html = embedCode('https://app.example/?a=1&b="<x>', 99999)
  assert.ok(html.includes('height="1200"'))
  assert.ok(html.includes('&amp;b=&quot;&lt;x>'))
  assert.ok(embedCode('https://app.example', NaN).includes('height="600"'))
  assert.ok(embedCode('https://app.example', -2).includes('height="240"'))
})
test('repository-hosted embeds retain the app base path and source', () => {
  const url = new URL(
    embedUrl(
      'https://user.github.io/pyramid/?url=old',
      imageSource(info),
      defaultEmbedOptions,
      undefined,
      undefined,
      '/pyramid'
    )
  )
  assert.equal(url.pathname, '/pyramid/embed/')
  assert.equal(url.searchParams.get('url'), info.id)
  assert.deepEqual(readEmbedOptions(url.searchParams), defaultEmbedOptions)
})
test('pyramid-only embeds omit image-dependent controls while retaining the source', () => {
  const url = new URL(
    embedUrl('https://app.example/', imageSource(info), {
      ...defaultEmbedOptions,
      layout: 'pyramid-only',
      figure: true,
      sync: true
    })
  )
  const options = readEmbedOptions(url.searchParams)
  assert.equal(options.layout, 'pyramid-only')
  assert.equal(url.searchParams.get('url'), info.id)
  assert.equal(options.controls, true)
  assert.equal(options.sync, false)
  assert.equal(options.figure, false)
  const manual = readEmbedOptions(
    new URLSearchParams('layout=pyramid-only&sync=1&figure=1')
  )
  assert.equal(manual.sync, false)
  assert.equal(manual.figure, false)
})
