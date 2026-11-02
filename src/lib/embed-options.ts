import type { SharedView } from './share-view.ts'
import type { ImageSource } from './iiif.ts'
import type { Bounds, PyramidLayout } from './geometry.ts'
import { contentState, sourceUrl } from './iiif-source.ts'
import { shareUrl } from './share-view.ts'

export type EmbedOptions = {
  layout: 'split' | 'image' | 'pyramid' | 'pyramid-only'
  header: boolean
  controls: boolean
  minimaps: boolean
  table: boolean
  grid: boolean
  figure: boolean
  sync: boolean
  scrollZoom: boolean
  tilt: 'left' | 'right'
  pyramidLayout: PyramidLayout
}
export const defaultEmbedOptions: EmbedOptions = {
  layout: 'split',
  header: false,
  controls: true,
  minimaps: true,
  table: false,
  grid: true,
  figure: false,
  sync: true,
  scrollZoom: false,
  tilt: 'right',
  pyramidLayout: 'stacked'
}
export function readEmbedOptions(params: URLSearchParams): EmbedOptions {
  const layout = params.get('layout')
  const options = {
    ...defaultEmbedOptions,
    layout: ['split', 'image', 'pyramid', 'pyramid-only'].includes(layout ?? '')
      ? (layout as EmbedOptions['layout'])
      : ('split' as const),
    tilt:
      params.get('tilt') === 'left' ? ('left' as const) : ('right' as const),
    pyramidLayout:
      params.get('pyramidLayout') === 'adjacent'
        ? ('adjacent' as const)
        : ('stacked' as const)
  }
  for (const key of [
    'header',
    'controls',
    'minimaps',
    'table',
    'grid',
    'figure',
    'sync',
    'scrollZoom'
  ] as const) {
    if (params.has(key))
      options[key] = params.get(key) === '1' || params.get(key) === 'true'
  }
  if (options.layout === 'pyramid-only') {
    options.sync = false
    options.figure = false
  }
  return options
}
export function embedUrl(
  base: string,
  source: ImageSource,
  options: EmbedOptions,
  view?: SharedView,
  viewport?: Bounds,
  basePath = ''
) {
  const url = sourceUrl(base, source, `${basePath}/embed/`)
  const effective =
    options.layout === 'pyramid-only'
      ? { ...options, sync: false, figure: false }
      : options
  for (const [key, value] of Object.entries(effective))
    url.searchParams.set(
      key,
      typeof value === 'boolean' ? (value ? '1' : '0') : value
    )
  if (view)
    return shareUrl(url.href, source.url, view, contentState(source, viewport))
  return url.href
}
export function embedCode(url: string, height: number) {
  const escaped = url
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
  const size = Number.isFinite(height)
    ? Math.max(240, Math.min(1200, Math.round(height)))
    : 600
  return `<iframe src="${escaped}" title="Allmaps IIIF Pyramid" width="100%" height="${size}" style="border:0" loading="lazy" allowfullscreen></iframe>`
}
