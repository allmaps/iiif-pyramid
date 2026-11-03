<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { base } from '$app/paths'
  import { Spring } from 'svelte/motion'
  import { figureFlightPosition } from './figure-flight'
  import type { FigureFlight } from './figure-flight'
  import { Map as MapLibreMap, LngLat, setWorkerUrl } from 'maplibre-gl'
  import type { CameraOptions } from 'maplibre-gl'
  import { handleTileTaps } from './tile-taps'
  import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
  import { WarpedMapEvent } from '@allmaps/render'
  import { Minus, Plus, CornersOut, PersonArmsSpread } from 'phosphor-svelte'
  import { PlanarMapLayer } from './PlanarMapLayer'
  import FollowControl from './FollowControl.svelte'
  import { tileCenter } from './tile-navigation'
  import PositionFigure from './PositionFigure.svelte'
  import type {
    FigureVariant,
    FigurePalette,
    HunterOutfit
  } from './iiif-figure'
  import Minimap from './Minimap.svelte'
  import ImageOverview from './ImageOverview.svelte'
  import {
    viewportCenter,
    positionVisible,
    figureDropTarget
  } from './position-marker'
  import { createScene, bounds, rectangle, clampViewport } from './geometry'
  import { virtualImageInfo } from './virtual-iiif'
  import { tileAt, isLargePyramid } from './iiif'
  import type {
    Scene,
    SceneLayer,
    Point,
    Bounds,
    TiltDirection,
    PyramidLayout
  } from './geometry'
  import type { ImageSource, Level, Tile } from './iiif'
  import type { PyramidSnapshot } from './export-view'
  import type { CameraPosition } from './share-view'

  type ViewerState = {
    viewport: Bounds
    level: Level
    tiles: Tile[]
    loaded: number
  }
  let {
    source,
    kind,
    grid,
    fillTilesOnHover = false,
    hoveredTile,
    viewport,
    activeFactor,
    positionViewport = viewport,
    positionFactor = activeFactor,
    followPaused = false,
    activeTiles,
    selected,
    answer,
    controls = true,
    minimaps = true,
    scrollZoom = true,
    showPositionFigure = false,
    figurePlacement = false,
    figureInteractive = true,
    figureVariant = 'iiif',
    figurePalette = 'iiif',
    outfit,
    tiltDirection = 'right',
    pyramidLayout = 'stacked',
    follow = false,
    linked,
    onfollow,
    initialRegion,
    initialCamera,
    initialFocusedLevel,
    onview,
    onmoving,
    onready,
    onselect,
    onhover,
    onlevel,
    onpositionstart,
    onpositioncancel,
    onpositiondrop,
    onfigurechange,
    onerror,
    onmanual
  }: {
    source: ImageSource
    kind: 'image' | 'pyramid'
    grid: boolean
    fillTilesOnHover?: boolean
    hoveredTile?: Tile
    viewport: Bounds | undefined
    activeFactor: number
    positionViewport?: Bounds
    positionFactor?: number
    followPaused?: boolean
    activeTiles: Tile[]
    selected: Tile | undefined
    answer?: Tile
    controls?: boolean
    minimaps?: boolean
    scrollZoom?: boolean
    showPositionFigure?: boolean
    figurePlacement?: boolean
    figureInteractive?: boolean
    figureVariant?: FigureVariant
    figurePalette?: FigurePalette
    outfit?: HunterOutfit
    tiltDirection?: TiltDirection
    pyramidLayout?: PyramidLayout
    follow?: boolean
    linked?: boolean
    onfollow?: () => void
    initialRegion?: Bounds
    initialCamera?: CameraPosition
    initialFocusedLevel?: number
    onview?: (view: ViewerState) => void
    onmoving?: (moving: boolean) => void
    onready?: () => void
    onselect: (tile: Tile | undefined) => void
    onhover?: (tile: Tile | undefined) => void
    onlevel?: (level: Level) => void
    onpositionstart?: () => void
    onpositioncancel?: () => void
    onpositiondrop?: (level: Level, point: Point) => Promise<void>
    onfigurechange?: (visible: boolean) => void
    onerror: (message: string) => void
    onmanual?: () => void
  } = $props()

  type Drawing = {
    id: string
    level: Level
    polygon: string
    grid: string
    footprint: string
    tiles: { key: string; polygon: string }[]
    selection: string
    answer: string
    label: Point
    opacity: number
  }
  let container: HTMLDivElement
  const surfaceId = $props.id()
  let map: MapLibreMap | undefined
  let layer: PlanarMapLayer | undefined
  let scene = $state.raw<Scene>()
  let ready = $state(false)
  let drawings = $state<Drawing[]>([])
  let hoverPoint: Point | undefined
  let reportedHoverKey: string | undefined
  let hoverHighlight = $state<{ id: string; polygon: string }>()
  let comparison = $state<{
    from: Point
    bend: Point
    to: Point
    guess: string
    correct: string
  }>()
  let size = $state({ width: 1, height: 1 })
  let camera = $state<Point[]>([])
  let zoomedIn = $state(false)
  let position = $state<{ screen: Point; world: Point }>()
  const figureMotion = new Spring<Point>([0, 0], {
    stiffness: 0.14,
    damping: 0.85,
    precision: 1e-10
  })
  let figureInitialized = false
  let figurePoint = $state<Point>()
  let figureFlight = $state.raw<FigureFlight>()
  let figureTravelling = $state(false)
  let cameraMoving = $state(false)
  let controllerMoving = $state(false)

  let figureHeld = $state.raw<Point>()
  let figureAction = 0
  type FigureTarget = { item: SceneLayer; point: Point }
  type FigureDrag = {
    pointerId: number
    element: HTMLButtonElement
    start: Point
    offset: Point
    anchor: Point
    moved: boolean
    tilt: number
    fromControl: boolean
    wasVisible: boolean
    target?: FigureTarget
  }
  let figureDrag = $state.raw<FigureDrag>()
  const figureAirborne = $derived(
    !!figureDrag ||
      !!figureFlight ||
      figureTravelling ||
      cameraMoving ||
      controllerMoving
  )
  const draggingFigure = $derived(!!figureDrag?.moved)
  const positionOnscreen = $derived(
    figurePoint && positionVisible(figurePoint, size.width, size.height)
  )
  const positionDirection = $derived(
    position
      ? (Math.atan2(
          position.screen[1] - size.height / 2,
          position.screen[0] - size.width / 2
        ) *
          180) /
          Math.PI +
          90
      : 0
  )
  let focusedFactor = $state<number>()
  let sceneVersion = $state(0)
  let lastView = ''
  let disposed = false
  let opacityFrame = 0
  let manualNavigation = false
  let interruptingNavigation = false
  let navigationLayer: SceneLayer | undefined
  let followingFlight = false
  let initialPyramidFocus = false
  let resizingView = false
  let resizeTimeout: ReturnType<typeof setTimeout> | undefined
  let appliedTilt: TiltDirection = 'right'
  let appliedLayout: PyramidLayout = 'stacked'
  let appliedGame = false
  let explorerCamera: CameraPosition | undefined
  let explorerFocus: number | undefined
  let layoutFrameRequest: AbortController | undefined
  const maskPrefix = $derived(`occlusion-${kind}`)
  const labelIds = $derived.by(() => {
    const placed: Drawing[] = []
    // Keep the active label, then omit labels that would overlap at small scales.
    const candidates = [...drawings].sort(
      (a, b) =>
        Number(b.level.scaleFactor === activeFactor) -
        Number(a.level.scaleFactor === activeFactor)
    )
    for (const drawing of candidates) {
      const [x, y] = drawing.label
      if (x < 0 || x > size.width - 65 || y < 48 || y > size.height - 50)
        continue
      if (
        placed.some(
          (other) =>
            Math.abs(other.label[1] - y) < 24 &&
            Math.abs(other.label[0] - x) < 70
        )
      )
        continue
      placed.push(drawing)
    }
    return new Set(placed.map((drawing) => drawing.id))
  })

  function opacity(item: SceneLayer) {
    if (figurePlacement || draggingFigure) return 1
    return kind === 'pyramid' &&
      item.level.scaleFactor > (focusedFactor ?? activeFactor)
      ? 0.18
      : 1
  }

  function screen(item: SceneLayer, point: Point): Point {
    const warped = layer!.getWarpedMap(item.id)!
    const world = warped.projectedTransformer.transformToProjectedGeo(point)
    const p = map!.project(world)
    return [p.x, p.y]
  }

  function resource(item: SceneLayer, point: Point): Point {
    const world = map!.unproject(point)
    return layer!
      .getWarpedMap(item.id)!
      .projectedTransformer.transformToResource([world.lng, world.lat])
  }

  function polygon(item: SceneLayer, box: Bounds) {
    return rectangle(box)
      .map((p) => screen(item, p).join(','))
      .join(' ')
  }

  function visibleResource(item: SceneLayer) {
    return clampViewport(
      rectangle([0, 0, size.width, size.height]).map((p) => resource(item, p)),
      source.image.width,
      source.image.height
    )
  }

  function startNavigation(point?: Point, item?: SceneLayer) {
    if (!map || !scene) return
    initialPyramidFocus = false
    if (!manualNavigation) {
      const anchor = point ?? [size.width / 2, size.height / 2]
      navigationLayer =
        item ??
        scene.layers.find((candidate) => {
          if (opacity(candidate) < 0.5) return false
          const [x, y] = resource(candidate, anchor)
          return (
            x >= 0 &&
            y >= 0 &&
            x <= source.image.width &&
            y <= source.image.height
          )
        }) ??
        scene.layers.find(
          (candidate) => candidate.level.scaleFactor === activeFactor
        )
      if (kind === 'pyramid' && navigationLayer)
        focusedFactor = navigationLayer.level.scaleFactor
    }
    // Only user navigation can take ownership. A following flight never drives
    // the other camera back, even when its tile level or viewport changes.
    manualNavigation = true
    endFollowingFlight(false)
    onmanual?.()
  }

  function navigationEnded() {
    manualNavigation = false
  }

  function navigate(action: () => void, item?: SceneLayer) {
    if (!map || !scene) return
    // End any previous flight before assigning the new gesture. Its moveend
    // must not publish a stale viewport or start another following flight.
    stopNavigation()
    startNavigation(undefined, item)
    action()
  }

  function animateCamera(options: CameraOptions) {
    if (kind === 'image') map?.easeTo(options)
    else map?.flyTo(options)
  }

  export function stopNavigation() {
    initialPyramidFocus = false
    if (!map) return
    endFollowingFlight(false)
    interruptingNavigation = true
    map.stop()
    interruptingNavigation = false
    manualNavigation = false
  }

  function flyWithFigure(options: CameraOptions) {
    if (!map) return
    // Stop the previous camera before assigning the next flight: flyTo.stop()
    // emits moveend synchronously and must not finish the replacement flight.
    endFollowingFlight(false)
    interruptingNavigation = true
    map.stop()
    interruptingNavigation = false
    const center = map.getCenter()
    const destination = LngLat.convert(options.center ?? center)
    const cameraFrom = {
      center: [center.lng, center.lat] as Point,
      zoom: map.getZoom()
    }
    const cameraTo = {
      center: [destination.lng, destination.lat] as Point,
      zoom: options.zoom ?? cameraFrom.zoom
    }
    if (
      Math.hypot(
        cameraFrom.center[0] - cameraTo.center[0],
        cameraFrom.center[1] - cameraTo.center[1]
      ) < 1e-10 &&
      Math.abs(cameraFrom.zoom - cameraTo.zoom) < 1e-10
    ) {
      updateFigure()
      return
    }
    const origin = map.unproject(
      figurePoint && positionVisible(figurePoint, size.width, size.height)
        ? figurePoint
        : [size.width / 2, size.height / 2]
    )
    void figureMotion.set(figureMotion.current, { instant: true })
    figureFlight = position
      ? {
          from: [origin.lng, origin.lat],
          to: position.world,
          cameraFrom,
          cameraTo
        }
      : undefined
    followingFlight = true
    // MapLibre owns the easing and duration. Project from its actual camera
    // every move event, so zoom-out and pan carry the figure together.
    map.flyTo(options)
  }

  function endFollowingFlight(land: boolean) {
    followingFlight = false
    const flight = figureFlight
    if (!flight || !map) return
    const current = map.unproject(
      figurePoint ?? [size.width / 2, size.height / 2]
    )
    figureFlight = undefined
    // On interruption, preserve the figure's visible position. On arrival,
    // attach it to the destination with no second spring animation.
    void figureMotion.set(land ? flight.to : [current.lng, current.lat], {
      instant: true
    })
    figureInitialized = true
    projectFigure()
  }

  function visibleTiles(level: Level, box: Bounds) {
    if (box[0] >= box[2] || box[1] >= box[3]) return []
    const tw = level.tileWidth * level.scaleFactor,
      th = level.tileHeight * level.scaleFactor
    const result: Tile[] = []
    for (
      let row = Math.max(0, Math.floor(box[1] / th));
      row < Math.min(level.rows, Math.ceil(box[3] / th));
      row++
    ) {
      for (
        let column = Math.max(0, Math.floor(box[0] / tw));
        column < Math.min(level.columns, Math.ceil(box[2] / tw));
        column++
      ) {
        result.push(tileAt(source, level, column, row))
      }
    }
    return result
  }

  function tilePolygon(item: SceneLayer, tile: Tile) {
    const [x, y, w, h] = tile.region
    return polygon(item, [x, y, x + w, y + h])
  }

  function tileAtPoint(point: Point) {
    if (!scene || !layer) return
    // Hover and click share the same front-to-back hit test. Faded layers
    // must not intercept the tile on the active plane below them.
    for (const item of scene.layers) {
      if (opacity(item) < 0.5) continue
      const p = resource(item, point)
      if (
        p[0] < 0 ||
        p[1] < 0 ||
        p[0] >= source.image.width ||
        p[1] >= source.image.height
      )
        continue
      const level =
        kind === 'image'
          ? source.levels.find((level) => level.scaleFactor === activeFactor)
          : item.level
      if (!level) return
      return {
        item,
        tile: tileAt(
          source,
          level,
          Math.floor(p[0] / (level.tileWidth * level.scaleFactor)),
          Math.floor(p[1] / (level.tileHeight * level.scaleFactor))
        )
      }
    }
  }

  function updateHover() {
    if (
      !fillTilesOnHover ||
      !hoverPoint ||
      !map ||
      map.isMoving() ||
      figureDrag ||
      figureHeld
    ) {
      publishHover()
      return
    }
    publishHover(tileAtPoint(hoverPoint)?.tile)
  }

  function publishHover(tile?: Tile) {
    if (tile?.key === reportedHoverKey) return
    reportedHoverKey = tile?.key
    onhover?.(tile)
  }

  function projectHover() {
    // The shared tile stays in image coordinates, so both surfaces can draw
    // the same region without changing their camera or active resolution.
    const item =
      fillTilesOnHover && hoveredTile && scene && layer
        ? kind === 'image'
          ? scene.layers[0]
          : scene.layers.find(
              (item) => item.level.scaleFactor === hoveredTile.level.scaleFactor
            )
        : undefined
    const next =
      item && hoveredTile
        ? { id: item.id, polygon: tilePolygon(item, hoveredTile) }
        : undefined
    if (
      next?.id !== hoverHighlight?.id ||
      next?.polygon !== hoverHighlight?.polygon
    )
      hoverHighlight = next
  }

  function clearHover() {
    hoverPoint = undefined
    publishHover()
  }

  function gridPath(item: SceneLayer, level: Level, box: Bounds) {
    if (!grid) return ''
    const tw = level.tileWidth * level.scaleFactor,
      th = level.tileHeight * level.scaleFactor
    const origin = screen(item, [0, 0]),
      x = screen(item, [Math.min(tw, source.image.width), 0]),
      y = screen(item, [0, Math.min(th, source.image.height)])
    // Dense grids disappear instead of turning the entire image into a solid fill.
    if (
      Math.min(
        Math.hypot(x[0] - origin[0], x[1] - origin[1]),
        Math.hypot(y[0] - origin[0], y[1] - origin[1])
      ) < 4
    )
      return ''
    const line = (a: Point, b: Point) =>
      `M${screen(item, a).join(',')}L${screen(item, b).join(',')}`
    const lines: string[] = []
    for (
      let c = Math.max(1, Math.floor(box[0] / tw));
      c < Math.min(level.columns, Math.ceil(box[2] / tw) + 1);
      c++
    )
      lines.push(line([c * tw, box[1]], [c * tw, box[3]]))
    for (
      let r = Math.max(1, Math.floor(box[1] / th));
      r < Math.min(level.rows, Math.ceil(box[3] / th) + 1);
      r++
    )
      lines.push(line([box[0], r * th], [box[2], r * th]))
    return lines.join('')
  }

  function refresh() {
    if (!map || !layer || !scene || disposed) return
    const canvas = map.getCanvas()
    if (!canvas.clientWidth || !canvas.clientHeight) return
    size = { width: canvas.clientWidth, height: canvas.clientHeight }
    const [x0, y0, x1, y1] = scene.bounds
    const overview = map.cameraForBounds(
      [
        [x0, y0],
        [x1, y1]
      ],
      { padding: kind === 'image' ? 48 : 62, maxZoom: 20 }
    )
    zoomedIn =
      overview?.zoom !== undefined && map.getZoom() > overview.zoom + 0.05
    const finest = scene.layers[0]
    if (kind === 'image') {
      const warped = layer.getWarpedMap(finest.id)
      const zoom = warped?.tileZoomLevelForViewport
      if (zoom) {
        const level = source.levels.find(
          (level) => level.scaleFactor === zoom.scaleFactor
        )!
        const view = visibleResource(finest)
        const tiles = visibleTiles(level, view)
        const loaded = tiles.filter((tile) =>
          layer!.renderer!.tileCache.getCacheableTile(tile.url)?.isCachedTile()
        ).length
        const signature = `${view.map((n) => n.toFixed(2))}/${level.scaleFactor}/${loaded}`
        if (signature !== lastView) {
          lastView = signature
          onview?.({ viewport: view, level, tiles, loaded })
        }
      }
    }
    drawings = [...scene.layers].reverse().map((item) => {
      const label = map!.project(item.label)
      const level =
        kind === 'image'
          ? (source.levels.find((l) => l.scaleFactor === activeFactor) ??
            item.level)
          : item.level
      return {
        id: item.id,
        level,
        opacity: opacity(item),
        polygon: polygon(item, [0, 0, source.image.width, source.image.height]),
        grid: gridPath(item, level, visibleResource(item)),
        footprint:
          kind === 'pyramid' && viewport ? polygon(item, viewport) : '',
        tiles:
          level.scaleFactor === activeFactor
            ? activeTiles.map((tile) => ({
                key: tile.key,
                polygon: tilePolygon(item, tile)
              }))
            : [],
        selection:
          selected &&
          selected.level.scaleFactor === activeFactor &&
          selected.level.scaleFactor === level.scaleFactor
            ? tilePolygon(item, selected)
            : '',
        label: [label.x, label.y],
        answer:
          answer?.level.scaleFactor === level.scaleFactor
            ? tilePolygon(item, answer)
            : ''
      }
    })
    const guessedLayer =
      selected &&
      scene.layers.find(
        (item) => item.level.scaleFactor === selected.level.scaleFactor
      )
    const correctLayer =
      answer &&
      scene.layers.find(
        (item) => item.level.scaleFactor === answer.level.scaleFactor
      )
    if (
      kind === 'pyramid' &&
      selected &&
      answer &&
      guessedLayer &&
      correctLayer
    ) {
      const center = (tile: Tile): Point => [
        tile.region[0] + tile.region[2] / 2,
        tile.region[1] + tile.region[3] / 2
      ]
      comparison = {
        from: screen(guessedLayer, center(selected)),
        bend: screen(guessedLayer, center(answer)),
        to: screen(correctLayer, center(answer)),
        guess: tilePolygon(guessedLayer, selected),
        correct: tilePolygon(correctLayer, answer)
      }
    } else comparison = undefined
    const center = viewportCenter(positionViewport)
    const active = scene.layers.find(
      (item) => item.level.scaleFactor === positionFactor
    )
    if (kind === 'pyramid' && center && active) {
      const world = layer
        .getWarpedMap(active.id)!
        .projectedTransformer.transformToProjectedGeo(center)
      const point = map.project(world)
      position = { world, screen: [point.x, point.y] }
    } else position = undefined
    updateFigure()
    updateHover()
    projectHover()
    camera = rectangle([0, 0, size.width, size.height]).map((point) => {
      const p = map!.unproject(point)
      return [p.lng, p.lat]
    })
  }

  function projectFigure() {
    if (!map || !position || !showPositionFigure) {
      figurePoint = undefined
      figureTravelling = false
      return
    }
    if (figureDrag) {
      figurePoint = figureDrag.anchor
      return
    }
    let world = figureMotion.current
    if (figureFlight) {
      const center = map.getCenter()
      world = figureFlightPosition(figureFlight, {
        center: [center.lng, center.lat],
        zoom: map.getZoom()
      })
    }
    const point = map.project(world)
    const target = map.project(figureMotion.target)
    figureTravelling =
      !figureFlight && Math.hypot(point.x - target.x, point.y - target.y) > 0.35
    figurePoint = [point.x, point.y]
  }

  function updateFigure() {
    if (!showPositionFigure || !position) {
      figureInitialized = false
      figurePoint = undefined
      figureTravelling = false
      return
    }
    if (
      !figureDrag &&
      !figureFlight &&
      (!followPaused || figureHeld || !figureInitialized)
    ) {
      const target = figureHeld ?? position.world
      if (
        !figureInitialized ||
        target.some((n, i) => n !== figureMotion.target[i])
      ) {
        void figureMotion.set(target, {
          instant:
            !figureInitialized ||
            !!figureHeld ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        })
        figureInitialized = true
      }
    }
    projectFigure()
  }

  function pointerPoint(event: PointerEvent): Point {
    const box = container.getBoundingClientRect()
    return [event.clientX - box.left, event.clientY - box.top]
  }

  function startFigureDrag(
    event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement },
    fromControl = false
  ) {
    if (
      !figureInteractive ||
      event.button !== 0 ||
      !scene ||
      (!fromControl && !figurePoint)
    )
      return
    event.preventDefault()
    event.stopPropagation()
    cancelFigureDrag()
    stopNavigation()
    onpositionstart?.()
    const point = pointerPoint(event)
    const anchor: Point = fromControl
      ? [point[0], point[1] + 28]
      : [...figurePoint!]
    figureDrag = {
      pointerId: event.pointerId,
      element: event.currentTarget,
      start: point,
      offset: [anchor[0] - point[0], anchor[1] - point[1]],
      anchor,
      moved: false,
      tilt: 0,
      fromControl,
      wasVisible: showPositionFigure
    }
    if (fromControl) onfigurechange?.(true)
    projectFigure()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveFigureDrag(event: PointerEvent) {
    if (!figureDrag || event.pointerId !== figureDrag.pointerId || !scene)
      return
    const point = pointerPoint(event)
    const anchor: Point = [
      point[0] + figureDrag.offset[0],
      point[1] + figureDrag.offset[1]
    ]
    const moved =
      figureDrag.moved ||
      Math.hypot(
        point[0] - figureDrag.start[0],
        point[1] - figureDrag.start[1]
      ) > 4
    const inside =
      point[0] >= 0 &&
      point[1] >= 0 &&
      point[0] <= size.width &&
      point[1] <= size.height
    figureDrag = {
      ...figureDrag,
      anchor,
      moved,
      tilt: Math.max(
        -12,
        Math.min(12, (anchor[0] - figureDrag.anchor[0]) * 0.7)
      ),
      target:
        moved && inside
          ? figureDropTarget(
              scene.layers,
              (item) => resource(item, anchor),
              source.image.width,
              source.image.height
            )
          : undefined
    }
    projectFigure()
  }

  function releaseFigurePointer() {
    const drag = figureDrag
    if (drag && map) {
      const world = map.unproject(drag.anchor)
      void figureMotion.set([world.lng, world.lat], { instant: true })
      figureInitialized = true
    }
    figureDrag = undefined
    if (drag?.element.hasPointerCapture(drag.pointerId))
      drag.element.releasePointerCapture(drag.pointerId)
    return drag
  }

  function cancelFigureDrag() {
    figureAction++
    const hadInteraction = !!figureDrag || !!figureHeld
    const drag = releaseFigurePointer()
    if (drag?.fromControl) onfigurechange?.(drag.wasVisible)
    figureHeld = undefined
    if (hadInteraction) onpositioncancel?.()
    updateFigure()
  }

  async function dropFigure(target: FigureTarget) {
    if (!layer) return
    const action = ++figureAction
    figureHeld = layer
      .getWarpedMap(target.item.id)!
      .projectedTransformer.transformToProjectedGeo(target.point)
    focusedFactor = target.item.level.scaleFactor
    updateFigure()
    try {
      await onpositiondrop?.(target.item.level, target.point)
    } finally {
      if (action === figureAction && !disposed) {
        figureHeld = undefined
        updateFigure()
      }
    }
  }

  function endFigureDrag(event: PointerEvent) {
    if (!figureDrag || event.pointerId !== figureDrag.pointerId) return
    moveFigureDrag(event)
    const drag = releaseFigurePointer()!
    if (drag.moved && drag.target) void dropFigure(drag.target)
    else {
      onpositioncancel?.()
      if (drag.fromControl && !figurePlacement)
        onfigurechange?.(drag.moved ? drag.wasVisible : !drag.wasVisible)
      updateFigure()
      if (!drag.moved && (!drag.fromControl || figurePlacement))
        locatePosition()
    }
  }

  export function locatePosition() {
    if (!map || !position) return
    // This locates the existing image viewport; it must not become a new
    // pyramid navigation gesture and send the image camera somewhere else.
    endFollowingFlight(false)
    interruptingNavigation = true
    map.stop()
    interruptingNavigation = false
    manualNavigation = false
    followingFlight = false
    flyWithFigure({ center: position.world })
  }

  export async function fitAfterResize(
    signal: AbortSignal,
    level?: Level,
    center?: Point
  ) {
    if (signal.aborted || disposed) return
    // Let MapLibre's ResizeObserver own the canvas. Calling resize() again here
    // would clear the frame it just drew and can cause a flash.
    await new Promise<void>((resolve) => {
      let frame = 0
      const finish = () => {
        cancelAnimationFrame(frame)
        signal.removeEventListener('abort', finish)
        resolve()
      }
      const waitForSize = () => {
        if (signal.aborted || disposed) {
          finish()
          return
        }
        if (!map || !scene) {
          frame = requestAnimationFrame(waitForSize)
          return
        }
        const canvas = map.getCanvas()
        if (
          !resizingView &&
          container.clientWidth > 0 &&
          container.clientHeight > 0 &&
          canvas.clientWidth === container.clientWidth &&
          canvas.clientHeight === container.clientHeight
        ) {
          finish()
          return
        }
        frame = requestAnimationFrame(waitForSize)
      }
      signal.addEventListener('abort', finish, { once: true })
      frame = requestAnimationFrame(waitForSize)
    })
    if (!signal.aborted && !disposed) {
      // Mode entry begins at the overview immediately, then makes just one
      // flight to the top tile after the canvas has its final dimensions.
      await fit(false)
      if (level && !signal.aborted && !disposed)
        await focusLevel(
          level,
          center ?? [source.image.width / 2, source.image.height / 2]
        )
    }
  }

  async function fit(animate = true) {
    if (!map || !scene) return
    // A previous flight's moveend must not resolve this fit's completion.
    endFollowingFlight(false)
    interruptingNavigation = true
    map.stop()
    interruptingNavigation = false
    focusedFactor = undefined
    const [x0, y0, x1, y1] = scene.bounds
    if (!animate) {
      const camera = map.cameraForBounds(
        [
          [x0, y0],
          [x1, y1]
        ],
        { padding: kind === 'image' ? 48 : 62, maxZoom: 20 }
      )
      if (camera) map.jumpTo(camera)
      return
    }
    const flight = map.once('moveend')
    map.fitBounds(
      [
        [x0, y0],
        [x1, y1]
      ],
      {
        padding: kind === 'image' ? 48 : 62,
        maxZoom: 20,
        linear: kind === 'image'
      }
    )
    await flight
  }

  export function getExportSnapshot(): PyramidSnapshot | undefined {
    if (!ready || !map || !layer || !scene) return
    const canvas = map.getCanvas()
    const center = map.getCenter()
    const a = map.unproject([0, 0]),
      b = map.unproject([1, 0])
    return {
      kind,
      source,
      scene,
      view: {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        center: [center.lng, center.lat],
        scale: Math.abs(b.lng - a.lng)
      },
      opacities: Object.fromEntries(
        scene.layers.map((item) => [
          item.id,
          layer!.getWarpedMap(item.id)!.options.opacity
        ])
      ),
      grid,
      showPositionFigure,
      figureVariant,
      figurePalette,
      viewport: viewport ? [...viewport] : undefined,
      activeFactor,
      activeTiles: [...activeTiles],
      selected
    }
  }

  export function getCameraPosition(): CameraPosition | undefined {
    if (!ready || !scene || !map) return
    const center = map.getCenter()
    return { center: [center.lng, center.lat], zoom: map.getZoom() }
  }

  export async function celebratePosition(signal: AbortSignal) {
    if (!map || !figurePlacement || signal.aborted) return
    try {
      const { celebrateIIIF } = await import('./iiif-confetti')
      // The correction flight can move the figure. Launch from its visible
      // position once that flight finishes, and cancel when the round ends.
      while (map.isMoving() && !signal.aborted && !disposed) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            map?.off('moveend', finish)
            signal.removeEventListener('abort', finish)
            resolve()
          }
          map!.once('moveend', finish)
          signal.addEventListener('abort', finish, { once: true })
        })
      }
      if (
        signal.aborted ||
        disposed ||
        !figurePlacement ||
        !figurePoint ||
        !positionOnscreen
      )
        return
      await celebrateIIIF(
        container.parentElement!,
        [figurePoint[0], figurePoint[1] - 28],
        signal
      )
    } catch (cause) {
      // A decorative effect must never prevent scoring or advancing the game.
      console.warn('Could not display IIIF confetti', cause)
    }
  }

  export function getFocusedLevel() {
    return focusedFactor
  }

  /** Keep a keyboard-selected tile visible without changing the current zoom. */
  export function zoomBy(delta: number) {
    if (map) navigate(() => animateCamera({ zoom: map!.getZoom() + delta }))
  }

  /** Analog input already supplies animation frames; avoid queuing camera flights. */
  export function driveCamera(pan: Point, zoom: number) {
    controllerMoving = !!(pan[0] || pan[1] || zoom)
    if (!controllerMoving || !map || !scene) return
    const item = scene.layers.find(
      (item) => item.level.scaleFactor === activeFactor
    )
    navigate(() => {
      map!.jumpTo({
        center: map!.unproject([
          size.width / 2 + pan[0],
          size.height / 2 + pan[1]
        ]),
        zoom: map!.getZoom() + zoom
      })
    }, item)
  }

  export function fitToView() {
    navigate(() => void fit())
  }

  /** Recenter a game guess without changing the resolution or camera zoom. */
  export function centerTile(tile: Tile) {
    if (!map || !layer || !scene) return
    const item = scene.layers.find(
      (item) => item.level.scaleFactor === tile.level.scaleFactor
    )
    if (!item) return
    const center = layer
      .getWarpedMap(item.id)!
      .projectedTransformer.transformToProjectedGeo(tileCenter(tile))
    navigate(() => flyWithFigure({ center }), item)
  }

  export function revealTile(tile: Tile) {
    if (!map || !layer || !scene) return
    const item = scene.layers.find(
      (item) => item.level.scaleFactor === tile.level.scaleFactor
    )
    if (!item) return
    const center = tileCenter(tile)
    const point = screen(item, center)
    if (
      point[0] >= 70 &&
      point[0] <= size.width - 70 &&
      point[1] >= 90 &&
      point[1] <= size.height - 90
    )
      return
    navigate(
      () =>
        animateCamera({
          center: layer!
            .getWarpedMap(item.id)!
            .projectedTransformer.transformToProjectedGeo(center)
        }),
      item
    )
  }

  /** Frame the position correction and the jump between resolutions together. */
  export function focusComparison(guess: Tile, correct: Tile) {
    if (!map || !layer || !scene) return
    const guessedLayer = scene.layers.find(
      (item) => item.level.scaleFactor === guess.level.scaleFactor
    )!
    const correctLayer = scene.layers.find(
      (item) => item.level.scaleFactor === correct.level.scaleFactor
    )!
    const project = (item: SceneLayer, p: Point) =>
      layer!
        .getWarpedMap(item.id)!
        .projectedTransformer.transformToProjectedGeo(p)
    const corners = (item: SceneLayer, tile: Tile) => {
      const [x, y, w, h] = tile.region
      return rectangle([x, y, x + w, y + h]).map((p) => project(item, p))
    }
    const [x, y, w, h] = correct.region
    const box = bounds([
      ...corners(guessedLayer, guess),
      ...corners(correctLayer, correct),
      project(guessedLayer, [x + w / 2, y + h / 2])
    ])
    focusedFactor = Math.min(guess.level.scaleFactor, correct.level.scaleFactor)
    return navigate(
      () =>
        map!.fitBounds(
          [
            [box[0], box[1]],
            [box[2], box[3]]
          ],
          {
            padding: Math.min(100, size.width * 0.16, size.height * 0.2),
            maxZoom: 24
          }
        ),
      correctLayer
    )
  }

  export async function focusLevel(level: Level, center?: Point) {
    if (!map || !layer || !scene) return
    const item = scene.layers.find(
      (item) => item.level.scaleFactor === level.scaleFactor
    )
    let flight: Promise<void> | undefined
    let finish: (() => void) | undefined
    navigate(() => {
      if (!map || !layer || !scene) return
      flight = new Promise<void>((resolve) => {
        finish = resolve
        map!.once('moveend', finish)
      })
      if (kind === 'image') {
        const renderer = layer.renderer!
        const item = scene.layers[0]
        const a = screen(item, [0, 0]),
          b = screen(item, [level.scaleFactor, 0])
        const currentScale =
          level.scaleFactor / Math.hypot(b[0] - a[0], b[1] - a[1])
        // Center the camera in Allmaps' selection interval for this level.
        // Its default half-level correction otherwise puts buttons on a boundary.
        const targetScale =
          level.scaleFactor / 2 ** renderer.options.log2ScaleFactorCorrection -
          renderer.options.scaleFactorCorrection
        animateCamera({
          center: center
            ? layer
                .getWarpedMap(item.id)!
                .projectedTransformer.transformToProjectedGeo(center)
            : undefined,
          zoom: map.getZoom() + Math.log2(currentScale / targetScale)
        })
      } else {
        focusedFactor = level.scaleFactor
        const item = scene.layers.find(
          (item) => item.level.scaleFactor === level.scaleFactor
        )!
        const location = center ??
          viewportCenter(positionViewport) ?? [
            source.image.width / 2,
            source.image.height / 2
          ]
        const region = clampViewport(
          [
            [
              location[0] - level.tileWidth * level.scaleFactor * 2.5,
              location[1] - level.tileHeight * level.scaleFactor * 2.5
            ],
            [
              location[0] + level.tileWidth * level.scaleFactor * 2.5,
              location[1] + level.tileHeight * level.scaleFactor * 2.5
            ]
          ],
          source.image.width,
          source.image.height
        )
        const transformer = layer.getWarpedMap(item.id)!.projectedTransformer
        const [x0, y0, x1, y1] = bounds(
          rectangle(region).map((point) =>
            transformer.transformToProjectedGeo(point)
          )
        )
        const camera = map.cameraForBounds(
          [
            [x0, y0],
            [x1, y1]
          ],
          { padding: 70 }
        )
        if (figurePlacement && camera) {
          // Near image edges, the clipped framing region is asymmetric. Keep
          // its useful zoom while placing the figure itself at screen center.
          flyWithFigure({
            center: transformer.transformToProjectedGeo(location),
            zoom: camera.zoom
          })
        } else
          map.fitBounds(
            [
              [x0, y0],
              [x1, y1]
            ],
            { padding: 70 }
          )
      }
    }, item)
    if (map.isMoving()) await flight
    if (finish) map.off('moveend', finish)
  }

  function autoFollow() {
    if (figureDrag || figureHeld || resizingView || followPaused) return
    if (!follow || !scene || !map || manualNavigation || map.isMoving()) return
    if (kind === 'image') return
    if (!positionViewport) return
    if (initialPyramidFocus) {
      const item = scene.layers.find(
        (item) => item.level.scaleFactor === positionFactor
      )
      if (!item) return
      const [x0, y0, x1, y1] = bounds(item.corners)
      const camera = map.cameraForBounds(
        [
          [x0, y0],
          [x1, y1]
        ],
        { padding: 70, maxZoom: 24 }
      )
      if (!camera) return
      // Wait for the initial overview and image viewport, then bring the tiny
      // current plane into view once. This flight never drives the image back.
      initialPyramidFocus = false
      flyWithFigure(camera)
      return
    }
    if (
      positionViewport[2] - positionViewport[0] >= source.image.width * 0.98 &&
      positionViewport[3] - positionViewport[1] >= source.image.height * 0.98
    )
      return
    const item = scene.layers.find(
      (item) => item.level.scaleFactor === positionFactor
    )
    if (!item) return
    const a = screen(item, [0, 0])
    const b = screen(item, [
      Math.min(source.image.width, item.level.tileWidth * positionFactor),
      0
    ])
    const tileSize = Math.hypot(b[0] - a[0], b[1] - a[1])
    const center: Point = [
      (positionViewport[0] + positionViewport[2]) / 2,
      (positionViewport[1] + positionViewport[3]) / 2
    ]
    const target = screen(item, center)
    const offscreen =
      target[0] < 70 ||
      target[0] > size.width - 70 ||
      target[1] < 70 ||
      target[1] > size.height - 70
    if (tileSize >= 26 && !offscreen) return
    const world = layer!
      .getWarpedMap(item.id)!
      .projectedTransformer.transformToProjectedGeo(center)
    flyWithFigure({
      center: world,
      zoom: map.getZoom() + Math.max(0, Math.log2(40 / tileSize))
    })
  }

  $effect(() => {
    if (!ready) return
    const current = source
    untrack(() => {
      stopNavigation()
      cancelAnimationFrame(opacityFrame)
      cancelFigureDrag()
      figureInitialized = false
      // A source change reuses map IDs. Give Allmaps a fresh renderer so cached
      // visibility, image and tile state cannot survive under those same IDs.
      if (scene) {
        map!.removeLayer(layer!.id)
        layer = addImageLayer()
      }
      lastView = ''
      clearHover()
      manualNavigation = false
      navigationLayer = undefined
      followingFlight = false
      initialPyramidFocus = false
      appliedTilt = tiltDirection
      appliedLayout = pyramidLayout
      appliedGame = figurePlacement
      explorerCamera = undefined
      explorerFocus = undefined
      layoutFrameRequest?.abort()
      scene = createScene(
        current,
        kind,
        `${location.origin}${base}`,
        appliedTilt,
        appliedLayout
      )
      layer!.addImageInfos(
        kind === 'image'
          ? [current.info]
          : scene.layers.map((item) =>
              virtualImageInfo(
                current.info,
                item.map.resource.id,
                item.level.scaleFactor
              )
            )
      )
      // Bottom first, smallest/top layer last.
      for (const item of [...scene.layers].reverse())
        layer!.addGeoreferencedMap(item.map, { opacity: opacity(item) })
      sceneVersion++
      if (initialCamera && !figurePlacement) {
        focusedFactor = initialFocusedLevel
        map!.jumpTo(initialCamera)
      } else if (kind === 'image' && initialRegion) {
        const transformer = layer!.getWarpedMap(
          scene.layers[0].id
        )!.projectedTransformer
        const [x0, y0, x1, y1] = bounds(
          rectangle(initialRegion).map((point) =>
            transformer.transformToProjectedGeo(point)
          )
        )
        map!.fitBounds(
          [
            [x0, y0],
            [x1, y1]
          ],
          { padding: 48, maxZoom: 24, duration: 0, linear: true }
        )
      } else void fit(false)
      // Fitting an unchanged overview can emit moveend synchronously. Arm the
      // startup flight afterward so it cannot be interrupted by that same fit.
      initialPyramidFocus =
        kind === 'pyramid' &&
        !figurePlacement &&
        !initialCamera &&
        isLargePyramid(current.levels)
      refresh()
      autoFollow()
    })
  })

  $effect(() => {
    const direction = tiltDirection
    const layout = pyramidLayout
    const game = figurePlacement
    if (!ready || kind !== 'pyramid') return
    untrack(() => {
      if (
        !scene ||
        (direction === appliedTilt &&
          layout === appliedLayout &&
          game === appliedGame)
      )
        return
      const layoutChanged = layout !== appliedLayout
      const modeChanged = game !== appliedGame
      if (modeChanged && game) {
        explorerCamera = getCameraPosition()
        explorerFocus = focusedFactor
      }
      layoutFrameRequest?.abort()
      stopNavigation()
      cancelFigureDrag()
      figureInitialized = false
      initialPyramidFocus = false
      if (direction !== appliedTilt || layoutChanged) {
        const next = createScene(
          source,
          kind,
          `${location.origin}${base}`,
          direction,
          layout
        )
        const maps = new Map(next.layers.map((item) => [item.id, item.map]))
        // Update the existing maps so their loaded images and tiles are retained.
        layer!.setMapsOptions((id) => ({ gcps: maps.get(id)!.gcps }), {
          animate: false
        })
        scene = next
        sceneVersion++
      }
      appliedTilt = direction
      appliedLayout = layout
      appliedGame = game
      if (modeChanged && !game) {
        focusedFactor = explorerFocus
        if (explorerCamera) map!.jumpTo(explorerCamera)
        else {
          // A direct game URL has no previous explorer camera to restore.
          layoutFrameRequest = new AbortController()
          void fitAfterResize(layoutFrameRequest.signal)
        }
      } else if (layoutChanged || (modeChanged && game)) void fit(false)
      refresh()
    })
  })

  $effect(() => {
    activeFactor
    follow
    untrack(() => {
      if (follow) focusedFactor = undefined
    })
  })

  $effect(() => {
    activeFactor
    focusedFactor
    draggingFigure
    figurePlacement
    sceneVersion
    if (!ready || !scene) return
    untrack(() => {
      cancelAnimationFrame(opacityFrame)
      if (figurePlacement) {
        layer!.setMapsOptions(() => ({ opacity: 1 }), { animate: false })
        refresh()
        return
      }
      const starts = new Map(
        scene!.layers.map((item) => [
          item.id,
          layer!.getWarpedMap(item.id)!.options.opacity
        ])
      )
      const targets = new Map(
        scene!.layers.map((item) => [item.id, opacity(item)])
      )
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches
        ? 0
        : 220
      const start = performance.now()
      // Opacity is a direct Allmaps uniform, so animate it without changing geometry.
      const frame = (now: number) => {
        const t = duration ? Math.min(1, (now - start) / duration) : 1
        const eased = t * t * (3 - 2 * t)
        layer!.setMapsOptions(
          (id) => ({
            opacity:
              starts.get(id)! + (targets.get(id)! - starts.get(id)!) * eased
          }),
          { animate: false }
        )
        if (t < 1) opacityFrame = requestAnimationFrame(frame)
      }
      opacityFrame = requestAnimationFrame(frame)
      refresh()
    })
  })

  $effect(() => {
    figureMotion.current
    untrack(projectFigure)
  })

  $effect(() => {
    showPositionFigure
    untrack(() => {
      if (!showPositionFigure) cancelFigureDrag()
      updateFigure()
    })
  })

  $effect(() => {
    hoveredTile
    fillTilesOnHover
    if (ready) untrack(projectHover)
  })

  $effect(() => {
    grid
    fillTilesOnHover
    viewport
    positionViewport
    positionFactor
    followPaused
    activeTiles
    selected
    answer
    follow
    if (!ready) return
    untrack(() => {
      if (followPaused) {
        // Cancel the old destination as soon as another image gesture starts.
        // Live tile/viewport overlays still refresh throughout the gesture.
        void figureMotion.set(figureMotion.current, { instant: true })
        if (followingFlight) {
          endFollowingFlight(false)
          interruptingNavigation = true
          map!.stop()
          interruptingNavigation = false
        }
      }
      if (!follow) {
        initialPyramidFocus = false
        if (followingFlight) {
          endFollowingFlight(false)
          map!.stop()
        }
      }
      if (follow) focusedFactor = undefined
      refresh()
      autoFollow()
    })
  })

  function addImageLayer() {
    const next = new PlanarMapLayer()
    map!.addLayer(next)
    next.renderer!.tileCache.addEventListener(
      'allrequestedtilesloaded',
      () => onready?.(),
      { once: true }
    )
    next.renderer!.addEventListener('imageinfofetcherror', () =>
      onerror(
        'An image could not be loaded. Check that the IIIF service allows browser requests.'
      )
    )
    next.renderer!.tileCache.addEventListener('tilefetcherror', (event) => {
      const message =
        event instanceof WarpedMapEvent ? event.error?.message : undefined
      onerror(
        message ?? 'Some tiles could not be loaded from this image service.'
      )
    })
    return next
  }

  onMount(() => {
    setWorkerUrl(mapLibreWorkerUrl)
    map = new MapLibreMap({
      container,
      style: {
        version: 8,
        projection: { type: 'identity' },
        sources: {},
        layers: []
      },
      center: [0, 0],
      zoom: 0,
      minZoom: -4,
      maxZoom: 24,
      maxPitch: 0,
      dragRotate: false,
      scrollZoom,
      pitchWithRotate: false,
      renderWorldCopies: false,
      attributionControl: false,
      canvasContextAttributes: { antialias: true }
    })
    map.touchZoomRotate.disableRotation()
    map.keyboard.disable()
    map.on('load', () => {
      layer = addImageLayer()
      ready = true
    })
    map.on('render', refresh)
    map.on('move', projectFigure)
    map.on('resize', () => {
      // MapLibre already observes its container and redraws synchronously after
      // resizing the canvas. A second observer clears that freshly drawn frame.
      // Resize events also emit moveend; resume camera following only once the
      // layout settles, so it does not chase the changing viewport dimensions.
      resizingView = true
      if (followingFlight) {
        stopNavigation()
      }
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        resizingView = false
        refresh()
        if (map?.isMoving()) return
        if (manualNavigation) navigationEnded()
        else autoFollow()
      }, 150)
    })
    map.on('moveend', () => {
      cameraMoving = false
      if (interruptingNavigation) {
        if (kind === 'image') onmoving?.(false)
        return
      }
      endFollowingFlight(true)
      refresh()
      if (kind === 'image') onmoving?.(false)
      if (resizingView) return
      if (manualNavigation) navigationEnded()
      else autoFollow()
    })
    map.on('error', (event) => onerror(event.error.message))
    map.on('movestart', (event) => {
      cameraMoving = true
      publishHover()
      if (kind === 'image') onmoving?.(true)
      const original = event.originalEvent
      if (!original) return
      const touch =
        typeof TouchEvent !== 'undefined' && original instanceof TouchEvent
          ? original.touches[0]
          : undefined
      const pointer =
        touch ?? (original instanceof MouseEvent ? original : undefined)
      const box = container.getBoundingClientRect()
      startNavigation(
        pointer
          ? [pointer.clientX - box.left, pointer.clientY - box.top]
          : undefined
      )
    })
    map.on('click', (event) => {
      onselect(tileAtPoint([event.point.x, event.point.y])?.tile)
    })
    map.on('mousemove', (event) => {
      if (event.originalEvent.buttons) {
        clearHover()
        return
      }
      hoverPoint = [event.point.x, event.point.y]
      updateHover()
    })
    map.on('mouseout', clearHover)
    map.on('mousedown', () => {
      publishHover()
    })
    map.on('touchstart', clearHover)
    handleTileTaps(
      map,
      () => figurePlacement && figureInteractive,
      (point) => onselect(tileAtPoint(point)?.tile)
    )
    return () => {
      disposed = true
      layoutFrameRequest?.abort()
      endFollowingFlight(false)
      cancelFigureDrag()
      void figureMotion.set(figureMotion.current, { instant: true })
      cancelAnimationFrame(opacityFrame)
      clearTimeout(resizeTimeout)
      map?.remove()
    }
  })

  function miniPoint(point: Point): Point {
    if (!scene) return [0, 0]
    const [x0, y0, x1, y1] = scene.bounds
    const s = Math.min(164 / (x1 - x0), 116 / (y1 - y0))
    return [
      90 + (point[0] - (x0 + x1) / 2) * s,
      66 - (point[1] - (y0 + y1) / 2) * s
    ]
  }

  function centerImage(point: Point) {
    if (!map || !layer || !scene) return
    const item = scene.layers[0]
    const center = layer
      .getWarpedMap(item.id)!
      .projectedTransformer.transformToProjectedGeo(point)
    navigate(() => map!.easeTo({ center }), item)
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape' && (figureDrag || figureHeld)) {
      event.preventDefault()
      cancelFigureDrag()
    }
  }}
/>

<div
  id={surfaceId}
  class="map-surface"
  class:isometric={kind === 'pyramid'}
  bind:this={container}
  aria-label={kind === 'image'
    ? 'Zoomable IIIF image'
    : 'Zoomable tile pyramid'}
></div>
<svg
  class="vector-overlay"
  width={size.width}
  height={size.height}
  aria-hidden="true"
>
  <defs>
    <filter
      id={`${maskPrefix}-figure-shadow`}
      x="-50%"
      y="-100%"
      width="200%"
      height="300%"
    >
      <feGaussianBlur stdDeviation="2" />
    </filter>
    <marker
      id={`${maskPrefix}-position-arrow`}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
      ><path d="M0 0L10 5L0 10Z" fill="#c42686" /></marker
    >
    <marker
      id={`${maskPrefix}-resolution-arrow`}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
      ><path d="M0 0L10 5L0 10Z" fill="#087349" /></marker
    >
    {#each drawings as drawing, i (drawing.id)}
      <mask
        id={`${maskPrefix}-${drawing.id}`}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width={size.width}
        height={size.height}
      >
        <polygon points={drawing.polygon} fill="white" />
        {#each drawings.slice(i + 1) as above}
          <polygon
            points={above.polygon}
            fill="black"
            opacity={above.opacity}
          />
        {/each}
      </mask>
    {/each}
  </defs>
  {#each drawings as drawing (drawing.id)}
    <g
      opacity={drawing.opacity}
      mask={`url(#${maskPrefix}-${drawing.id})`}
      class="plane-vectors"
    >
      {#if grid}<path d={drawing.grid} class="tile-grid-shadow" /><path
          d={drawing.grid}
          class="tile-grid"
        />{/if}
      {#if grid}
        {#each drawing.tiles as tile (tile.key)}<polygon
            points={tile.polygon}
            class="active-tile"
            class:viewer-active={kind === 'image'}
          />{/each}
      {/if}
      {#if kind === 'pyramid'}
        <polygon
          points={drawing.footprint}
          class:current={drawing.level.scaleFactor === activeFactor}
          class="viewport-footprint"
        />
      {/if}
      {#if hoverHighlight?.id === drawing.id}<polygon
          points={hoverHighlight.polygon}
          class="hovered-tile"
        />{/if}
      {#if drawing.selection}<polygon
          points={drawing.selection}
          class="selected-tile"
        />{/if}
      {#if drawing.answer}<polygon
          points={drawing.answer}
          class="answer-tile"
        />{/if}
      {#if showPositionFigure && figurePoint && !figureAirborne && drawing.level.scaleFactor === positionFactor}
        <g
          class="placed-figure-shadow"
          transform={`translate(${figurePoint[0]} ${figurePoint[1]})`}
        >
          <ellipse
            cx="5"
            cy="1"
            rx="18"
            ry="6"
            fill="#20372866"
            filter={`url(#${maskPrefix}-figure-shadow)`}
          />
          <ellipse rx="7" ry="2.5" fill="#10251b55" />
        </g>
      {/if}
    </g>
    <polygon
      points={drawing.polygon}
      class="plane-outline"
      opacity={drawing.opacity}
    />
  {/each}
  {#if comparison}
    <g class="tile-comparison">
      <polygon points={comparison.guess} class="comparison-guess" />
      <polygon points={comparison.correct} class="comparison-answer" />
      <path
        class="comparison-halo"
        d={`M${comparison.from}L${comparison.bend}L${comparison.to}`}
      />
      {#if Math.hypot(comparison.from[0] - comparison.bend[0], comparison.from[1] - comparison.bend[1]) > 1}<path
          class="comparison-position"
          d={`M${comparison.from}L${comparison.bend}`}
          marker-end={`url(#${maskPrefix}-position-arrow)`}
        />{/if}
      {#if selected?.level.scaleFactor !== answer?.level.scaleFactor}<path
          class="comparison-resolution"
          d={`M${comparison.bend}L${comparison.to}`}
          marker-end={`url(#${maskPrefix}-resolution-arrow)`}
        />{/if}
      <circle
        cx={comparison.from[0]}
        cy={comparison.from[1]}
        r="5"
        class="comparison-origin"
      />
      <circle
        cx={comparison.to[0]}
        cy={comparison.to[1]}
        r="5"
        class="comparison-destination"
      />
    </g>
  {/if}
  {#if figureDrag?.moved && figureDrag.target}
    <polygon
      class="figure-drop-plane"
      points={polygon(figureDrag.target.item, [
        0,
        0,
        source.image.width,
        source.image.height
      ])}
    />
  {/if}
</svg>
{#if kind === 'pyramid'}
  <div class="level-labels" aria-label="Pyramid levels">
    {#each drawings as drawing (drawing.id)}
      {#if labelIds.has(drawing.id)}
        <button
          class:current={drawing.level.scaleFactor === activeFactor}
          style:left={`${drawing.label[0] + 10}px`}
          style:top={`${drawing.label[1] - 12}px`}
          onclick={() => onlevel?.(drawing.level)}
          aria-pressed={drawing.level.scaleFactor === activeFactor}
          title={`Go to resolution 1:${drawing.level.scaleFactor}`}
        >
          1:{drawing.level.scaleFactor}
        </button>
      {/if}
    {/each}
  </div>
  {#if showPositionFigure && position && figurePoint}
    {#if positionOnscreen || figureDrag}
      <button
        class="position-marker"
        class:dragging={!!figureDrag}
        class:flying={figureAirborne && !figureDrag}
        class:invalid={figureDrag?.moved && !figureDrag.target}
        style:left={`${figurePoint[0]}px`}
        style:top={`${figurePoint[1]}px`}
        disabled={!figureInteractive}
        aria-label={`${figurePlacement ? 'Guess' : 'Image position'} at 1:${positionFactor}. Drag to ${figurePlacement ? 'place your guess' : 'explore'}`}
        aria-describedby="position-figure-help"
        title={`${figurePlacement ? 'Your guess' : 'Image position'} · 1:${positionFactor} — drag to place, click to center`}
        onpointerdown={(event) => startFigureDrag(event)}
        onpointermove={moveFigureDrag}
        onpointerup={endFigureDrag}
        onpointercancel={cancelFigureDrag}
        onlostpointercapture={() => {
          if (figureDrag) cancelFigureDrag()
        }}
        onclick={(event) => {
          if (event.detail === 0) locatePosition()
        }}
      >
        <PositionFigure
          shadow={false}
          {outfit}
          variant={figureVariant}
          palette={figurePalette}
          dragging={figureAirborne}
          invalid={!!figureDrag?.moved && !figureDrag.target}
          tilt={figureDrag?.tilt ?? 0}
        />
      </button>
    {:else}
      <button
        class="position-locator"
        onclick={locatePosition}
        aria-label={`Find image position at 1:${positionFactor} in the pyramid`}
        title="Bring the image position back into view"
      >
        <svg
          width="16"
          height="16"
          viewBox="-8 -8 16 16"
          aria-hidden="true"
          style:transform={`rotate(${positionDirection}deg)`}
        >
          <path
            d="M0 6V-6M-4-2 0-6 4-2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {figurePlacement ? 'Your guess' : 'Image position'}
      </button>
    {/if}
    <span id="position-figure-help" class="sr-only"
      >Drag onto a pyramid layer to {figurePlacement
        ? 'place your guess'
        : 'move the image there'}. Arrow keys move within the current level.
      Escape cancels a drag.</span
    >
    {#if figureDrag?.moved}
      <div
        class="figure-drop-label"
        class:invalid={!figureDrag.target}
        style:left={`${figurePoint[0]}px`}
        style:top={`${figurePoint[1] + 12}px`}
        role="status"
      >
        {figureDrag.target
          ? `${figurePlacement ? 'Place guess at' : 'Move image to'} 1:${figureDrag.target.item.level.scaleFactor}`
          : 'Drop on a layer'}
      </div>
    {/if}
  {/if}
{/if}
{#if scene && minimaps}
  <Minimap {kind} visible={zoomedIn} game={figurePlacement}>
    {#if kind === 'image'}
      <ImageOverview {source} {viewport} oncenter={centerImage} />
    {:else}
      <svg viewBox="0 0 180 132" role="group" aria-label="Minimap levels">
        {#each [...scene.layers].reverse() as item}
          <polygon
            class="minimap-level"
            role="button"
            tabindex="0"
            aria-label={`Go to resolution 1:${item.level.scaleFactor}`}
            aria-pressed={item.level.scaleFactor === activeFactor}
            onclick={() => onlevel?.(item.level)}
            onkeydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onlevel?.(item.level)
              }
            }}
            points={item.corners.map((p) => miniPoint(p).join(',')).join(' ')}
            fill={item.level.scaleFactor === activeFactor
              ? '#f8c7e2'
              : '#d0e5d8'}
            stroke="#668673"
            stroke-width="0.7"
            ><title>Go to resolution 1:{item.level.scaleFactor}</title></polygon
          >
        {/each}
        <polygon
          pointer-events="none"
          aria-hidden="true"
          points={camera.map((p) => miniPoint(p).join(',')).join(' ')}
          fill="#ff56ba12"
          stroke="#d12c85"
          stroke-width="1.4"
        />
        {#if position}
          {@const spot = miniPoint(position.world)}
          <circle
            pointer-events="none"
            aria-hidden="true"
            cx={spot[0]}
            cy={spot[1]}
            r="4"
            fill="#ed3c9d"
            stroke="white"
            stroke-width="1.5"
          />
        {/if}
      </svg>
    {/if}
  </Minimap>
{/if}
{#if controls}<div class="map-navigation" data-overlay-obstacle>
    {#if kind === 'pyramid' && linked !== undefined && onfollow}<FollowControl
        enabled={linked}
        onclick={onfollow}
      />{/if}
    {#if kind === 'pyramid' && !figurePlacement && onfigurechange}
      <button
        class="figure-control"
        class:dragging={figureDrag?.fromControl}
        aria-label="Image position figure"
        aria-pressed={showPositionFigure}
        title="Show or hide image position · drag onto a layer to place"
        disabled={!position || !figureInteractive}
        onpointerdown={(event) => startFigureDrag(event, true)}
        onpointermove={moveFigureDrag}
        onpointerup={endFigureDrag}
        onpointercancel={cancelFigureDrag}
        onlostpointercapture={() => {
          if (figureDrag?.fromControl) cancelFigureDrag()
        }}
        onclick={(event) => {
          if (event.detail === 0) onfigurechange?.(!showPositionFigure)
        }}
      >
        <PersonArmsSpread size={20} />
      </button>
    {/if}
    <button
      title="Zoom in"
      aria-label={`Zoom into ${kind}`}
      onclick={() => {
        zoomBy(1)
      }}><Plus size={18} /></button
    >
    <button
      title="Zoom out"
      aria-label={`Zoom out of ${kind}`}
      onclick={() => {
        zoomBy(-1)
      }}><Minus size={18} /></button
    >
    <span></span>
    <button
      title="Fit to view"
      aria-label={`Fit ${kind} to view`}
      onclick={() => {
        fitToView()
      }}><CornersOut size={18} /></button
    >
  </div>{/if}
