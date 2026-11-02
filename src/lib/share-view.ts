import type { Point, TiltDirection, PyramidLayout } from './geometry.ts'
import type { PyramidSnapshot } from './export-view.ts'
import { parseSyncMode } from './sync-mode.ts'
import type { SyncMode } from './sync-mode.ts'

export type CameraPosition = { center: Point; zoom: number }
export type SharedView = {
  image: CameraPosition
  pyramid: CameraPosition
  level: number
  focusedLevel?: number
  layout: 'split' | 'image' | 'pyramid'
  split: number
  tilt: TiltDirection
  pyramidLayout: PyramidLayout
  grid: boolean
  figure: boolean
  sync: SyncMode
}
export type ShareSnapshot = {
  view: SharedView
  pyramid: PyramidSnapshot
}

const round = (value: number) => Number(value.toFixed(9))
const cameraText = (camera: CameraPosition) =>
  [...camera.center, camera.zoom].map(round).join(',')

/** Versioned, readable camera coordinates stay in the client-side URL fragment. */
export function shareUrl(
  base: string,
  source: string,
  view: SharedView,
  contentState?: string
) {
  const url = new URL(base)
  for (const key of ['iiif-content', 'manifest', 'canvas', 'canvas-index'])
    url.searchParams.delete(key)
  if (contentState) {
    url.searchParams.delete('url')
    url.searchParams.set('iiif-content', contentState)
  } else url.searchParams.set('url', source)
  const params = new URLSearchParams({
    v: '1',
    image: cameraText(view.image),
    pyramid: cameraText(view.pyramid),
    level: String(view.level),
    layout: view.layout,
    split: String(Math.round(view.split)),
    tilt: view.tilt,
    arrangement: view.pyramidLayout,
    grid: view.grid ? '1' : '0',
    figure: view.figure ? '1' : '0',
    sync: view.sync === 'none' ? '0' : '1'
  })
  if (view.focusedLevel !== undefined)
    params.set('focus', String(view.focusedLevel))
  url.hash = params.toString()
  return url.href
}

export function readSharedView(hash: string): SharedView | undefined {
  if (hash.length > 2000) return
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (params.get('v') !== '1') return
  const camera = (key: string): CameraPosition | undefined => {
    const parts = params.get(key)?.split(',')
    if (!parts || parts.length !== 3 || parts.some((part) => !part.trim()))
      return
    const [x, y, zoom] = parts.map(Number)
    if (
      ![x, y, zoom].every(Number.isFinite) ||
      Math.abs(x) > 10000 ||
      Math.abs(y) > 10000 ||
      zoom < -4 ||
      zoom > 24
    )
      return
    return { center: [x, y], zoom }
  }
  const image = camera('image')
  const pyramid = camera('pyramid')
  const level = Number(params.get('level'))
  const focus = params.has('focus') ? Number(params.get('focus')) : undefined
  const layout = params.get('layout')
  const tilt = params.get('tilt')
  const pyramidLayout = params.get('arrangement') ?? 'stacked'
  const split = Number(params.get('split'))
  const sync = parseSyncMode(params.get('sync'))
  if (
    !image ||
    !pyramid ||
    !Number.isSafeInteger(level) ||
    level < 1 ||
    (focus !== undefined && (!Number.isSafeInteger(focus) || focus < 1)) ||
    !['split', 'image', 'pyramid'].includes(layout ?? '') ||
    !['left', 'right'].includes(tilt ?? '') ||
    !['stacked', 'adjacent'].includes(pyramidLayout) ||
    !Number.isFinite(split) ||
    split < 25 ||
    split > 75 ||
    !sync ||
    ['grid', 'figure'].some(
      (key) => !['0', '1'].includes(params.get(key) ?? '')
    )
  )
    return
  return {
    image,
    pyramid,
    level,
    focusedLevel: focus,
    layout: layout as SharedView['layout'],
    tilt: tilt as TiltDirection,
    pyramidLayout: pyramidLayout as PyramidLayout,
    split,
    grid: params.get('grid') === '1',
    figure: params.get('figure') === '1',
    sync
  }
}
