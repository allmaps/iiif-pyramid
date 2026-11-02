import { Manifest } from '@allmaps/iiif-parser'
import {
  decodeContentState,
  normaliseContentState,
  serialiseContentState
} from '@iiif/helpers/content-state'
import type { ContentState } from '@iiif/helpers/content-state'
import { examples, imageSource, loadImage } from './iiif.ts'
import type { ImageSource } from './iiif.ts'
import type { Bounds } from './geometry.ts'
import type { ImageInfo } from './virtual-iiif.ts'

type Json = Record<string, unknown>
export type CanvasChoice = {
  id: string
  label: string
  width: number
  height: number
  imageUrl: string
  imageBounds: Bounds
}
export type ManifestSource = {
  url: string
  title: string
  canvases: CanvasChoice[]
  skipped: number
}
export type LoadedSource = {
  source: ImageSource
  manifest?: ManifestSource
  region?: Bounds
  notice?: string
}
export type SourceOptions = {
  canvas?: string | null
  canvasIndex?: string | null
}
type Spatial = {
  x: number
  y: number
  width?: number
  height?: number
  unit?: string
}
const object = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {}
const array = (value: unknown): unknown[] =>
  value == null ? [] : Array.isArray(value) ? value : [value]
const id = (value: unknown) =>
  typeof value === 'string'
    ? value
    : String(object(value).id ?? object(value)['@id'] ?? '')
const type = (value: unknown) =>
  String(object(value).type ?? object(value)['@type'] ?? '').replace(/^sc:/, '')

export function label(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value
  if (Array.isArray(value))
    return (
      value
        .map((v) => label(v))
        .filter(Boolean)
        .join(' · ') || fallback
    )
  const language = object(value)
  return (
    label(
      language.en ??
        language.none ??
        language['@value'] ??
        Object.values(language)[0]
    ) || fallback
  )
}

export function sourceInput(params: URLSearchParams) {
  return (
    params.get('iiif-content') ||
    params.get('manifest') ||
    params.get('url') ||
    examples[0].url
  )
}

function httpUrl(value: string) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Use an HTTP or HTTPS IIIF URL.')
  return url
}

async function jsonAt(value: string, signal: AbortSignal) {
  const url = httpUrl(value)
  url.hash = ''
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/ld+json, application/json' }
  })
  if (!response.ok)
    throw new Error(`The IIIF resource returned HTTP ${response.status}.`)
  return (await response.json()) as unknown
}

function fragmentBox(
  value: string,
  width: number,
  height: number
): Bounds | undefined {
  const match =
    /(?:#|&|^)xywh=(?:(pixel|percent):)?([\d.+-]+),([\d.+-]+),([\d.+-]+),([\d.+-]+)/.exec(
      value
    )
  if (!match) return
  return spatialBox(
    {
      unit: match[1],
      x: Number(match[2]),
      y: Number(match[3]),
      width: Number(match[4]),
      height: Number(match[5])
    },
    width,
    height
  )
}

function spatialBox(spatial: Spatial, width: number, height: number): Bounds {
  const { x, y, width: w, height: h } = spatial
  if (![x, y, w, h].every(Number.isFinite) || !w || !h || w <= 0 || h <= 0)
    throw new Error(
      'The Content State region must have a positive width and height.'
    )
  const sx = spatial.unit === 'percent' ? width / 100 : 1
  const sy = spatial.unit === 'percent' ? height / 100 : 1
  return [x * sx, y * sy, (x + w) * sx, (y + h) * sy]
}

/** Let Allmaps parse the image painting on each canvas, retaining usable pages
 * when a mixed-media manifest also contains canvases without tiled images. */
export function parseManifest(
  value: unknown,
  requested?: string
): ManifestSource {
  const raw = object(value)
  const v2 = type(raw) === 'Manifest' && !!raw['@id']
  const url = id(raw) || requested || ''
  httpUrl(url)
  const canvases = v2
    ? array(object(array(raw.sequences)[0]).canvases)
    : array(raw.items)
  const choices: CanvasChoice[] = []
  for (const entry of canvases) {
    const canvas = object(entry)
    try {
      const manifest = Manifest.parse(
        v2
          ? {
              ...raw,
              sequences: [
                { ...object(array(raw.sequences)[0]), canvases: [canvas] }
              ]
            }
          : { ...raw, items: [canvas] }
      )
      const parsed = manifest.canvases[0]
      if (!parsed?.image?.uri) continue
      const painting = v2
        ? object(array(canvas.images)[0])
        : object(array(object(array(canvas.items)[0]).items)[0])
      const target = painting.target ?? painting.on
      const paintingId =
        typeof target === 'string'
          ? target
          : id(object(target).source ?? target)
      const imageBounds =
        fragmentBox(paintingId, parsed.width, parsed.height) ??
        ([0, 0, parsed.width, parsed.height] as Bounds)
      choices.push({
        id: parsed.uri,
        label: label(parsed.label, `Page ${choices.length + 1}`),
        width: parsed.width,
        height: parsed.height,
        imageUrl: parsed.image.uri,
        imageBounds
      })
    } catch {
      /* Not an image canvas supported by the Allmaps parser. */
    }
  }
  if (!choices.length)
    throw new Error(
      'This manifest has no supported canvases with a tiled IIIF image service.'
    )
  return {
    url,
    title: label(raw.label, 'IIIF manifest'),
    canvases: choices,
    skipped: canvases.length - choices.length
  }
}

export async function loadCanvas(
  manifest: ManifestSource,
  canvas: CanvasChoice,
  signal: AbortSignal
): Promise<ImageSource> {
  const source = await loadImage(canvas.imageUrl, signal)
  return {
    ...source,
    title: `${manifest.title} · ${canvas.label}`,
    presentation: {
      manifestUrl: manifest.url,
      manifestLabel: manifest.title,
      canvasId: canvas.id,
      canvasLabel: canvas.label,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      imageBounds: canvas.imageBounds
    }
  }
}

export function canvasRegionToImage(
  region: Bounds,
  source: ImageSource
): Bounds {
  const [x, y, x1, y1] = source.presentation!.imageBounds
  const sx = source.image.width / (x1 - x),
    sy = source.image.height / (y1 - y)
  const result: Bounds = [
    Math.max(0, (region[0] - x) * sx),
    Math.max(0, (region[1] - y) * sy),
    Math.min(source.image.width, (region[2] - x) * sx),
    Math.min(source.image.height, (region[3] - y) * sy)
  ]
  if (result[2] <= result[0] || result[3] <= result[1])
    throw new Error('The requested canvas region does not overlap this image.')
  return result
}

export function contentState(
  source: ImageSource,
  viewport?: Bounds
): string | undefined {
  const context = source.presentation
  if (!context) return
  const [x, y, x1, y1] = context.imageBounds
  const box = viewport ?? [0, 0, source.image.width, source.image.height]
  const region = [
    x + (box[0] * (x1 - x)) / source.image.width,
    y + (box[1] * (y1 - y)) / source.image.height,
    ((box[2] - box[0]) * (x1 - x)) / source.image.width,
    ((box[3] - box[1]) * (y1 - y)) / source.image.height
  ].map((n) => Number(n.toFixed(3)))
  return serialiseContentState({
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: `${context.manifestUrl}#pyramid-content-state`,
    type: 'Annotation',
    motivation: ['contentState'],
    target: {
      id: `${context.canvasId}#xywh=${region.join(',')}`,
      type: 'Canvas',
      partOf: [{ id: context.manifestUrl, type: 'Manifest' }]
    }
  } as ContentState)
}

export function sourceUrl(base: string, source: ImageSource, route?: string) {
  const url = new URL(base)
  if (route) url.pathname = route
  url.hash = ''
  for (const key of [
    'iiif-content',
    'manifest',
    'url',
    'canvas',
    'canvas-index'
  ])
    url.searchParams.delete(key)
  if (source.presentation) {
    url.searchParams.set('iiif-content', source.presentation.manifestUrl)
    url.searchParams.set('canvas', source.presentation.canvasId)
  } else url.searchParams.set('url', source.url)
  return url
}

export async function loadIIIFSource(
  input: string,
  signal: AbortSignal,
  options: SourceOptions = {}
): Promise<LoadedSource> {
  if (!input.trim() || input.length > 1_000_000)
    throw new Error('Enter a IIIF URL or a Content State smaller than 1 MB.')
  let value: unknown = input.trim()
  let requested = ''
  let canvasId = options.canvas || undefined
  let index = options.canvasIndex
  if (canvasId && /^\d+$/.test(canvasId) && !index) {
    index = canvasId
    canvasId = undefined
  }
  if (
    index != null &&
    (!/^\d+$/.test(index) || !Number.isSafeInteger(Number(index)))
  )
    throw new Error('Canvas index must be a non-negative integer.')
  let spatial: Spatial | undefined
  let fragment = ''
  let notice: string | undefined
  const visited = new Set<string>()
  for (let depth = 0; depth < 8; depth++) {
    signal.throwIfAborted()
    if (typeof value === 'string') {
      value = value.trim()
      if (/^[\[{]/.test(value as string)) {
        try {
          value = JSON.parse(value as string)
          continue
        } catch {
          throw new Error('The IIIF Content State is not valid JSON.')
        }
      }
      if (!/^https?:\/\//i.test(value as string)) {
        try {
          value = decodeContentState(value as string)
          continue
        } catch {
          throw new Error(
            'Enter a IIIF URL, JSON Content State, or base64url-encoded Content State.'
          )
        }
      }
      requested = value as string
      if (visited.has(requested))
        throw new Error('This IIIF resource contains a circular reference.')
      visited.add(requested)
      if (
        examples.some((example) => example.url === requested) ||
        /\/info\.json(?:$|[?#])/.test(requested)
      )
        return { source: await loadImage(requested, signal) }
      try {
        value = await jsonAt(requested, signal)
      } catch (cause) {
        signal.throwIfAborted()
        if (/[?#]|\.json$|\/manifest\/?$/.test(requested)) throw cause
        try {
          return { source: await loadImage(requested, signal) }
        } catch {
          throw cause
        }
      }
      // A fragment on a directly dereferenceable canvas is also a target.
      if (type(value) === 'Canvas') fragment ||= new URL(requested).hash
    }
    const raw = object(value)
    if (type(raw) === 'Manifest' && (raw.items || raw.sequences)) {
      const manifest = parseManifest(raw, requested)
      if (!canvasId && index == null) {
        const start = raw.start ?? object(array(raw.sequences)[0]).startCanvas
        canvasId = id(object(start).source ?? start).split('#')[0] || undefined
        fragment ||= id(object(start).source ?? start).split('#')[1] || ''
      }
      const canvas = canvasId
        ? manifest.canvases.find((c) => c.id === canvasId!.split('#')[0])
        : manifest.canvases[Number(index ?? 0)]
      if (!canvas)
        throw new Error(
          'The requested canvas is not an available tiled image in this manifest.'
        )
      const source = await loadCanvas(manifest, canvas, signal)
      const region = spatial
        ? spatialBox(spatial, canvas.width, canvas.height)
        : fragmentBox(fragment, canvas.width, canvas.height)
      if (manifest.skipped)
        notice = [
          notice,
          `${manifest.skipped} unsupported canvas${manifest.skipped === 1 ? '' : 'es'} omitted.`
        ]
          .filter(Boolean)
          .join(' ')
      return {
        source,
        manifest,
        region: region ? canvasRegionToImage(region, source) : undefined,
        notice
      }
    }
    if (
      (raw.protocol === 'http://iiif.io/api/image' ||
        /ImageService/.test(type(raw)) ||
        raw.tiles) &&
      raw.width &&
      raw.height
    )
      return { source: imageSource(raw as ImageInfo, requested) }
    if (type(raw) === 'Collection' || type(raw) === 'Range')
      throw new Error(
        'Open an image manifest or canvas instead of a collection or range.'
      )
    let normalized
    try {
      normalized = normaliseContentState(value as ContentState)
    } catch {
      throw new Error(
        'This resource is not a supported IIIF Manifest, image service, or Content State.'
      )
    }
    if (normalized.target.length > 1)
      notice = `Opened the first of ${normalized.target.length} Content State targets.`
    const target = normalized.target[0]
    if (!target?.source?.id)
      throw new Error('The Content State does not identify a resource.')
    const targetSource = object(target.source)
    const targetId = id(targetSource)
    if (target.selector && !target.selector.spatial)
      throw new Error(
        'Only spatial canvas regions are supported in this image viewer.'
      )
    spatial = target.selector?.spatial
    if (
      type(targetSource) === 'Canvas' ||
      array(targetSource.partOf).some((parent) => type(parent) === 'Manifest')
    ) {
      canvasId = options.canvas || targetId.split('#')[0]
      fragment = targetId.split('#')[1] || fragment
      const parent = array(targetSource.partOf).find(
        (parent) => type(parent) === 'Manifest'
      )
      if (!parent)
        throw new Error(
          'A Canvas Content State must identify its Manifest in partOf.'
        )
      value = id(parent)
    } else value = targetId
  }
  throw new Error('The IIIF Content State has too many nested references.')
}
