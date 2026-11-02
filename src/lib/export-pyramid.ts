import { Viewport } from '@allmaps/render'
import { WebGL2Renderer } from '@allmaps/render/webgl2'
import { lonLatProjection } from '@allmaps/project'
import { rectangle, clampViewport } from './geometry'
import { virtualImageInfo } from './virtual-iiif'
import { exportFrame } from './export-view'
import {
  viewportCenter,
  positionVisible,
  drawPositionFigure
} from './position-marker'
import type { ExportOptions, PyramidSnapshot } from './export-view'
import type { Bounds, Point, SceneLayer } from './geometry'

function nextFrame(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const abort = () => {
      cancelAnimationFrame(frame)
      reject(signal.reason)
    }
    const frame = requestAnimationFrame(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    })
    signal.addEventListener('abort', abort, { once: true })
  })
}

/** A separate renderer keeps export resolution and framing out of both live cameras. */
export async function exportPyramid(
  snapshot: PyramidSnapshot,
  options: ExportOptions,
  signal: AbortSignal,
  onprogress: (message: string) => void
) {
  const frame = exportFrame(snapshot.view, snapshot.scene.bounds, options)
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    preserveDrawingBuffer: true
  })
  if (!gl) throw new Error('This browser could not create an export canvas.')
  let renderer: WebGL2Renderer | undefined
  const output = document.createElement('canvas')
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(60_000)])
  try {
    const maxSide = Math.min(
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      ...gl.getParameter(gl.MAX_VIEWPORT_DIMS)
    )
    if (
      Math.max(frame.width, frame.height) > maxSide ||
      gl.drawingBufferWidth !== frame.width ||
      gl.drawingBufferHeight !== frame.height
    )
      throw new Error(
        'This device cannot export that size. Choose a lower resolution.'
      )
    renderer = new WebGL2Renderer(gl, {
      projection: lonLatProjection,
      internalProjection: lonLatProjection,
      anticipateInteraction: false,
      animatedOptions: [],
      renderGrid: false
    })
    const list = renderer.warpedMapList
    list.addImageInfos(
      snapshot.kind === 'image'
        ? [snapshot.source.info]
        : snapshot.scene.layers.map((item) =>
            virtualImageInfo(
              snapshot.source.info,
              item.map.resource.id,
              item.level.scaleFactor
            )
          )
    )
    const opacity = (item: SceneLayer) =>
      options.area === 'overview' ? 1 : snapshot.opacities[item.id]
    for (const item of [...snapshot.scene.layers].reverse())
      renderer.addGeoreferencedMap(item.map, { opacity: opacity(item) })
    // Image infos are already local, including each plane's resolution ceiling.
    await Promise.all(
      list.getWarpedMaps().map((map) => map.loadImage(list.imagesById))
    )
    deadline.throwIfAborted()
    const viewport = new Viewport(
      [frame.width, frame.height],
      frame.center,
      frame.scale,
      { projection: lonLatProjection, devicePixelRatio: 1 }
    )
    const visible = list.getWarpedMaps({
      projectedGeoBbox: viewport.projectedGeoRectangleBbox
    })
    let tileError = false
    renderer.tileCache.addEventListener('tilefetcherror', () => {
      tileError = true
    })
    onprogress('Loading export tiles…')
    // Wait for viewport preparation and GPU texture uploads, not just network
    // completion: a newly idle cache can otherwise produce an empty PNG.
    while (visible.length) {
      deadline.throwIfAborted()
      if (tileError)
        throw new Error(
          'Some tiles could not be loaded. Please try the export again.'
        )
      gl.clear(gl.COLOR_BUFFER_BIT)
      renderer.render(viewport)
      if (renderer.previousSignificantViewport === viewport) {
        const tiles = visible.flatMap((map) => map.fetchableTilesForViewport)
        const loaded = tiles.filter((tile) =>
          renderer!.tileCache.getCacheableTile(tile.tileUrl)?.isCachedTile()
        ).length
        onprogress(`Loading tiles · ${loaded} of ${tiles.length}`)
        if (
          visible.every((map) => {
            const uploaded = new Set(
              map.cachedTilesForTexture.map(
                (tile) => tile.fetchableTile.tileUrl
              )
            )
            return map.fetchableTilesForViewport.every((tile) =>
              uploaded.has(tile.tileUrl)
            )
          })
        )
          break
      }
      await nextFrame(deadline)
    }
    deadline.throwIfAborted()
    gl.clear(gl.COLOR_BUFFER_BIT)
    renderer.render(viewport)
    output.width = frame.width
    output.height = frame.height
    const context = output.getContext('2d')
    if (!context)
      throw new Error(
        'Could not create the export image. Try a lower resolution.'
      )
    if (!options.transparent) {
      context.fillStyle = '#edf4ed'
      context.fillRect(0, 0, frame.width, frame.height)
    }
    context.drawImage(canvas, 0, 0)
    if (options.overlays)
      drawOverlays(context, renderer, snapshot, frame, opacity)
    onprogress('Preparing PNG…')
    const blob = await new Promise<Blob>((resolve, reject) =>
      output.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('PNG encoding failed. Try a lower resolution.')),
        'image/png'
      )
    )
    deadline.throwIfAborted()
    return { blob, width: frame.width, height: frame.height }
  } catch (cause) {
    if (deadline.aborted && !signal.aborted)
      throw new Error(
        'The export timed out while loading tiles. Try again or choose a lower resolution.'
      )
    throw cause
  } finally {
    renderer?.destroy()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    canvas.width = canvas.height = output.width = output.height = 0
  }
}

function drawOverlays(
  context: CanvasRenderingContext2D,
  renderer: WebGL2Renderer,
  snapshot: PyramidSnapshot,
  frame: ReturnType<typeof exportFrame>,
  opacity: (item: SceneLayer) => number
) {
  const { width, height, center, scale, decorationScale: d } = frame
  const worldToScreen = ([x, y]: Point): Point => [
    width / 2 + (x - center[0]) / scale,
    height / 2 - (y - center[1]) / scale
  ]
  const screenToWorld = ([x, y]: Point): Point => [
    center[0] + (x - width / 2) * scale,
    center[1] - (y - height / 2) * scale
  ]
  const scratch = document.createElement('canvas')
  scratch.width = width
  scratch.height = height
  const ctx = scratch.getContext('2d')!
  const path = (points: Point[]) => {
    const p = new Path2D()
    points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)))
    p.closePath()
    return p
  }
  const layers = [...snapshot.scene.layers].reverse()
  const labels: { point: Point; factor: number }[] = []
  try {
    for (const [i, item] of layers.entries()) {
      const transformer = renderer.warpedMapList.getWarpedMap(
        item.id
      )!.projectedTransformer
      const project = (p: Point) =>
        worldToScreen(transformer.transformToProjectedGeo(p))
      const polygon = (b: Bounds) => path(rectangle(b).map(project))
      const visible = clampViewport(
        rectangle([0, 0, width, height]).map((p) =>
          transformer.transformToResource(screenToWorld(p))
        ),
        snapshot.source.image.width,
        snapshot.source.image.height
      )
      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.clip(path(item.corners.map(worldToScreen)))
      const level =
        snapshot.kind === 'image'
          ? snapshot.source.levels.find(
              (level) => level.scaleFactor === snapshot.activeFactor
            )!
          : item.level
      const tw = level.tileWidth * level.scaleFactor
      const th = level.tileHeight * level.scaleFactor
      const a = project([0, 0]),
        b = project([tw, 0]),
        c = project([0, th])
      if (
        snapshot.grid &&
        Math.min(
          Math.hypot(b[0] - a[0], b[1] - a[1]),
          Math.hypot(c[0] - a[0], c[1] - a[1])
        ) >=
          4 * d
      ) {
        const grid = new Path2D()
        const line = (from: Point, to: Point) => {
          grid.moveTo(...project(from))
          grid.lineTo(...project(to))
        }
        for (
          let col = Math.max(1, Math.floor(visible[0] / tw));
          col < Math.min(level.columns, Math.ceil(visible[2] / tw) + 1);
          col++
        )
          line([col * tw, visible[1]], [col * tw, visible[3]])
        for (
          let row = Math.max(1, Math.floor(visible[1] / th));
          row < Math.min(level.rows, Math.ceil(visible[3] / th) + 1);
          row++
        )
          line([visible[0], row * th], [visible[2], row * th])
        ctx.strokeStyle = '#253d3250'
        ctx.lineWidth = 2 * d
        ctx.stroke(grid)
        ctx.strokeStyle = '#ffffffa6'
        ctx.lineWidth = 0.75 * d
        ctx.stroke(grid)
      }
      const current = level.scaleFactor === snapshot.activeFactor
      if (snapshot.grid && current) {
        ctx.strokeStyle = '#ff56ba'
        ctx.lineWidth = 1.3 * d
        for (const tile of snapshot.activeTiles) {
          const [x, y, w, h] = tile.region
          const p = polygon([x, y, x + w, y + h])
          ctx.stroke(p)
        }
      }
      if (snapshot.kind !== 'image' && snapshot.viewport) {
        const p = polygon(snapshot.viewport)
        ctx.strokeStyle = current ? '#f2379d' : '#ff56ba75'
        ctx.lineWidth = (current ? 2 : 1) * d
        ctx.setLineDash(current ? [] : [3 * d, 3 * d])
        ctx.stroke(p)
        ctx.setLineDash([])
      }
      if (snapshot.selected?.level.scaleFactor === level.scaleFactor) {
        const [x, y, w, h] = snapshot.selected.region
        const p = polygon([x, y, x + w, y + h])
        ctx.strokeStyle = '#ed3c9d'
        ctx.lineWidth = 2.5 * d
        ctx.stroke(p)
      }
      ctx.restore()
      // Match the live SVG masks: upper images hide lower-plane overlays.
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = '#000'
      for (const above of layers.slice(i + 1)) {
        ctx.globalAlpha = opacity(above)
        ctx.fill(path(above.corners.map(worldToScreen)))
      }
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      context.globalAlpha = opacity(item)
      context.drawImage(scratch, 0, 0)
      context.strokeStyle = '#29463240'
      context.lineWidth = 0.75 * d
      context.stroke(path(item.corners.map(worldToScreen)))
      if (snapshot.kind !== 'image')
        labels.push({
          point: worldToScreen(item.label),
          factor: item.level.scaleFactor
        })
    }
    context.globalAlpha = 1
    const placed: Point[] = []
    for (const label of labels.sort(
      (a, b) =>
        Number(b.factor === snapshot.activeFactor) -
        Number(a.factor === snapshot.activeFactor)
    )) {
      const [x, y] = label.point
      if (
        x < 0 ||
        x > width - 65 * d ||
        y < 12 * d ||
        y > height - 12 * d ||
        placed.some(
          (p) => Math.abs(p[1] - y) < 24 * d && Math.abs(p[0] - x) < 70 * d
        )
      )
        continue
      placed.push(label.point)
      const current = label.factor === snapshot.activeFactor
      context.font = `${10 * d}px sans-serif`
      const text = `1:${label.factor}`,
        w = context.measureText(text).width + 12 * d
      const box = new Path2D()
      box.roundRect(x + 10 * d, y - 12 * d, w, 22 * d, 4 * d)
      context.fillStyle = current ? '#ffe5f3' : '#edf4ed'
      context.fill(box)
      context.strokeStyle = current ? '#ec87bc' : '#b6ccbc'
      context.lineWidth = d
      context.stroke(box)
      context.fillStyle = current ? '#9c2567' : '#5a7564'
      context.fillText(text, x + 16 * d, y + 3 * d)
    }
    const center = viewportCenter(snapshot.viewport)
    const active = snapshot.scene.layers.find(
      (item) => item.level.scaleFactor === snapshot.activeFactor
    )
    if (snapshot.showPositionFigure && center && active) {
      const world = renderer.warpedMapList
        .getWarpedMap(active.id)!
        .projectedTransformer.transformToProjectedGeo(center)
      const point = worldToScreen(world)
      if (positionVisible(point, width, height, d)) {
        context.save()
        context.clip(path(active.corners.map(worldToScreen)))
        context.translate(...point)
        context.scale(d, d)
        context.filter = `blur(${2 * d}px)`
        context.fillStyle = '#20372866'
        context.beginPath()
        context.ellipse(5, 1, 18, 6, 0, 0, Math.PI * 2)
        context.fill()
        context.filter = 'none'
        context.fillStyle = '#10251b55'
        context.beginPath()
        context.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2)
        context.fill()
        context.restore()
        drawPositionFigure(context, point, d, {
          variant: snapshot.figureVariant,
          palette: snapshot.figurePalette,
          shadow: false
        })
      }
    }
  } finally {
    scratch.width = scratch.height = 0
  }
}
