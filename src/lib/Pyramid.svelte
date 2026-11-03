<script lang="ts">
  import { dismissOnBackdrop } from './dismiss-on-backdrop'
  import { floatingPanel } from './floating-panel'
  import type { OverlayPlacement } from './floating-panel'
  import { onMount, tick, untrack } from 'svelte'
  import { afterNavigate, replaceState, goto } from '$app/navigation'
  import { base } from '$app/paths'
  import {
    ArrowSquareOut,
    X,
    ArrowClockwise,
    GameController,
    Columns,
    ArrowsOutSimple,
    ArrowsHorizontal
  } from 'phosphor-svelte'
  import MapSurface from './MapSurface.svelte'
  import Game from './Game.svelte'
  import ViewLayoutControls from './ViewLayoutControls.svelte'
  import PublishMenu from './PublishMenu.svelte'
  import LevelsPanel from './LevelsPanel.svelte'
  import About from './About.svelte'
  import Loading from './Loading.svelte'
  import TiltControl from './TiltControl.svelte'
  import { moveTile, tileAtPosition, tileCenter } from './tile-navigation'
  import { viewportCenter } from './position-marker'
  import ResourceControl from './ResourceControl.svelte'
  import type { EmbedOptions } from './embed-options'
  import {
    loadIIIFSource,
    loadCanvas,
    sourceInput,
    sourceUrl,
    contentState
  } from './iiif-source'
  import type {
    ManifestSource,
    CanvasChoice,
    SourceOptions,
    LoadedSource
  } from './iiif-source'
  import type { SyncMode } from './sync-mode'
  import { readSharedView } from './share-view'
  import type { SharedView, ShareSnapshot } from './share-view'
  import logo from './images/allmaps-logo.svg'
  import { examples, isLargePyramid } from './iiif'
  import { prepareTileProxy } from './service-worker'
  import { defaultHunterOutfit } from './iiif-figure'
  import type { ImageSource, Tile, Level } from './iiif'
  import type { Bounds, Point, TiltDirection, PyramidLayout } from './geometry'
  import type {
    FigureVariant,
    FigurePalette,
    HunterOutfit
  } from './iiif-figure'

  let {
    figureVariant = 'iiif',
    figurePalette = 'iiif',
    hunterOutfit = defaultHunterOutfit,
    game = false,
    embed
  }: {
    figureVariant?: FigureVariant
    figurePalette?: FigurePalette
    hunterOutfit?: HunterOutfit
    game?: boolean
    embed?: EmbedOptions
  } = $props()
  const pyramidOnly = $derived(embed?.layout === 'pyramid-only')
  const sourceExamples = [
    ...examples,
    {
      title: 'Closer to Johannes Vermeer',
      collection: 'Rijksmuseum · 37 paintings',
      url: `${base}/manifests/vermeer.json`
    }
  ]

  let source = $state<ImageSource>()
  let manifest = $state.raw<ManifestSource>()
  let initialRegion = $state<Bounds>()
  let notice = $state('')
  let baseHref = $state('')
  let input = $state(examples[0].url)
  let loading = $state(true)
  let error = $state('')
  let grid = $state(true)
  let fillTilesOnHover = $state(false)
  let showTileDetails = $state(false)
  let hovered = $state<{ view: 'image' | 'pyramid'; tile: Tile }>()
  let tiltDirection = $state<TiltDirection>('right')
  let pyramidLayout = $state<PyramidLayout>('stacked')
  let syncMode = $state<SyncMode>('image-to-pyramid')
  let showPositionFigure = $state(false)
  let positionDragging = $state(false)
  let positionAction = 0
  let drivingView = $state<'image' | 'pyramid'>('image')
  let viewport = $state<Bounds>()
  let activeFactor = $state(1)
  let imageMoving = $state(false)
  let settledViewport = $state<Bounds>()
  let settledFactor = $state(1)
  let activeTiles = $state<Tile[]>([])
  let selected = $state<Tile>()
  let pendingSelection: { tile: Tile; settled: boolean } | undefined
  let keyboardNavigation: { level: Level; tile?: Tile } | undefined
  const desktopInsetPlacement: OverlayPlacement = {}
  const mobileInsetPlacement: OverlayPlacement = {}
  let layout = $state<'split' | 'image' | 'pyramid'>('split')
  let fullView = $state<'image' | 'pyramid'>('pyramid')
  let stacked = $state(false)
  const insetPlacement = $derived(
    stacked ? mobileInsetPlacement : desktopInsetPlacement
  )
  let split = $state(50)
  let resizing = $state(false)
  let initialView = $state<SharedView>()
  // A shared view keeps both cameras exact until the next navigation gesture.
  let preserveSharedView = $state(false)
  let inputDialog: HTMLDialogElement
  let workspace: HTMLElement
  let imageView = $state<MapSurface>()
  let pyramidView = $state<MapSurface>()
  let pyramidReady = $state(false)
  let gameFramed = $state(false)
  let gameControls = $state<Game>()
  let gameGuess = $state<Tile>()
  let gameAnswer = $state<Tile>()
  let gameFactor = $state(1)
  let gameCanPlace = $state(false)
  let gameGrid = $state(true)
  const gamePosition = $derived<Bounds | undefined>(
    gameGuess
      ? [
          gameGuess.region[0],
          gameGuess.region[1],
          gameGuess.region[0] + gameGuess.region[2],
          gameGuess.region[1] + gameGuess.region[3]
        ]
      : source
        ? [0, 0, source.image.width, source.image.height]
        : undefined
  )
  let mounted = $state(false)
  let previousGame = false
  let controller: AbortController | undefined
  let proxy: Promise<void> | undefined
  const number = (n: number) => n.toLocaleString('en-US')

  function hoverTile(view: 'image' | 'pyramid', tile?: Tile) {
    if (tile) hovered = { view, tile }
    else if (hovered?.view === view) hovered = undefined
  }

  async function open(
    value = input,
    shared?: SharedView,
    options: SourceOptions = {},
    canvas?: CanvasChoice,
    roundSignal?: AbortSignal
  ) {
    controller?.abort()
    const request = new AbortController()
    controller = request
    const signal = roundSignal
      ? AbortSignal.any([request.signal, roundSignal])
      : request.signal
    loading = true
    hovered = undefined
    error = ''
    keyboardNavigation = undefined
    clearSelection()
    cancelPositionDrag()
    try {
      proxy ??= prepareTileProxy().catch((error) => {
        proxy = undefined
        throw error
      })
      const [, loaded] = await Promise.all([
        proxy,
        canvas && manifest
          ? loadCanvas(manifest, canvas, signal).then(
              (source) => ({ source, manifest }) as LoadedSource
            )
          : loadIIIFSource(value, signal, options)
      ])
      if (signal.aborted) return
      const next = loaded.source
      manifest = loaded.manifest
      initialRegion = loaded.region
      notice = loaded.notice ?? ''
      viewport = undefined
      settledViewport = undefined
      imageMoving = false
      activeTiles = []
      const validShared =
        shared &&
        next.levels.some((level) => level.scaleFactor === shared.level) &&
        (shared.focusedLevel === undefined ||
          next.levels.some(
            (level) => level.scaleFactor === shared.focusedLevel
          ))
          ? shared
          : undefined
      initialView = validShared
      preserveSharedView = !!validShared
      activeFactor = validShared?.level ?? next.levels[0].scaleFactor
      settledFactor = activeFactor
      syncMode = validShared?.sync ?? 'image-to-pyramid'
      if (validShared) {
        layout = validShared.layout
        if (layout !== 'split') fullView = layout
        split = validShared.split
        tiltDirection = validShared.tilt
        pyramidLayout = validShared.pyramidLayout
        grid = validShared.grid
      }
      drivingView = 'image'
      pyramidReady = false
      // The map can redraw before Game starts the new round. Its guess and
      // answer are in the previous canvas's pixel coordinates.
      gameGuess = undefined
      gameAnswer = undefined
      source = next
      gameFactor = activeFactor
      showPositionFigure = validShared?.figure ?? isLargePyramid(next.levels)
      if (embed) {
        layout = pyramidOnly ? 'pyramid' : (embed.layout as typeof layout)
        grid = embed.grid
        showPositionFigure = !pyramidOnly && embed.figure
        tiltDirection = embed.tilt
        pyramidLayout = embed.pyramidLayout
        syncMode = !pyramidOnly && embed.sync ? 'image-to-pyramid' : 'none'
      }
      input = next.presentation?.manifestUrl ?? next.url
      const url = sourceUrl(location.href, next)
      if (validShared) url.hash = location.hash
      else if (loaded.region) {
        url.searchParams.set('iiif-content', contentState(next, loaded.region)!)
        url.searchParams.delete('canvas')
      }
      replaceState(url, {})
      inputDialog.close()
      return true
    } catch (cause) {
      if (signal.aborted) return
      if (roundSignal && canvas) {
        notice = `Could not load “${canvas.label}”. This round uses the current canvas.`
        return false
      }
      error =
        cause instanceof Error
          ? cause.message
          : 'The image could not be loaded.'
      if (error === 'Failed to fetch')
        error =
          'The image service could not be reached. Check the URL and whether it allows cross-origin browser requests.'
    } finally {
      if (controller === request) loading = false
    }
  }

  function viewChanged(view: {
    viewport: Bounds
    level: Level
    tiles: Tile[]
  }) {
    viewport = view.viewport
    activeFactor = view.level.scaleFactor
    activeTiles = view.tiles
    if (!imageMoving) settleImageView()
    if (selected && selected.level.scaleFactor !== activeFactor)
      selected = undefined
    commitSelection()
  }

  function settleImageView() {
    settledViewport = viewport
    settledFactor = activeFactor
  }

  function imageMotionChanged(moving: boolean) {
    imageMoving = moving
    if (!moving) settleImageView()
  }

  function clearSelection() {
    pendingSelection = undefined
    selected = undefined
  }

  function commitSelection() {
    if (
      pendingSelection?.settled &&
      pendingSelection.tile.level.scaleFactor === activeFactor
    ) {
      selected = pendingSelection.tile
      pendingSelection = undefined
    }
  }

  function startNavigation(view: 'image' | 'pyramid') {
    preserveSharedView = false
    keyboardNavigation = undefined
    pendingSelection = undefined
    drivingView = view
  }

  function selectLevel(level: Level) {
    clearSelection()
    // The image takes ownership last: fitting a pyramid plane must not replace
    // the image's exact resolution with a generic fit-to-viewport zoom.
    void pyramidView?.focusLevel(level)
    if (pyramidOnly) activeFactor = level.scaleFactor
    return imageView?.focusLevel(level)
  }

  function toggleFollowing() {
    syncMode = syncMode === 'none' ? 'image-to-pyramid' : 'none'
    if (syncMode !== 'none') {
      drivingView = 'image'
      preserveSharedView = false
    }
  }

  function keydown(event: KeyboardEvent) {
    const arrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
      event.key
    )
    const levelKey = event.key === '[' || event.key === ']'
    const zoomKey = ['+', '=', '-', '_', '0'].includes(event.key)
    if (
      event.defaultPrevented ||
      event.isComposing ||
      (event.altKey && !event.getModifierState('AltGraph')) ||
      (levelKey &&
        (event.metaKey || event.ctrlKey) &&
        !event.getModifierState('AltGraph')) ||
      loading ||
      !source ||
      (!imageView && !pyramidOnly) ||
      !pyramidView ||
      positionDragging ||
      resizing ||
      document.querySelector(
        'dialog[open], [popover]:popover-open, [role=menu], .moving-overlay, .position-marker.dragging, .figure-control.dragging'
      )
    )
      return
    const target = event.target
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.closest(
          'input, textarea, select, [role="textbox"], [role="combobox"]'
        ))
    )
      return
    if (event.key === 'Escape') {
      keyboardNavigation = undefined
      if (game) {
        event.preventDefault()
        void goto(sourceUrl(baseHref, source, `${base}/`).href)
      } else clearSelection()
      return
    }
    if (
      game &&
      event.key === 'Enter' &&
      !(target instanceof HTMLElement && target.closest('button, a'))
    ) {
      event.preventDefault()
      if (!event.repeat) gameControls?.confirm()
      return
    }
    if (
      game &&
      ['b', 'g'].includes(event.key.toLowerCase()) &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault()
      if (!event.repeat) gameGrid = !gameGrid
      return
    }
    if (
      game &&
      event.key.toLowerCase() === 's' &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault()
      if (!event.repeat) gameControls?.skip()
      return
    }
    if (zoomKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault()
      const view =
        game || pyramidOnly || drivingView === 'pyramid'
          ? pyramidView
          : imageView
      if (event.key === '0') view?.fitToView()
      else view?.zoomBy(event.key === '-' || event.key === '_' ? -1 : 1)
      return
    }
    if (game && !gameCanPlace) return
    if (
      arrow &&
      target instanceof HTMLElement &&
      target.closest('[role="separator"], [data-drag-handle]')
    )
      return
    if (!arrow && !levelKey) return
    event.preventDefault()
    if (game && arrow) {
      gameControls?.moveGuess(event.key, event)
      return
    }

    // Keep the requested tile/level while a camera transition is running, so
    // repeated keys never restart from an intermediate rendered resolution.
    const factor =
      keyboardNavigation?.level.scaleFactor ??
      (game ? gameFactor : activeFactor)
    const index = source.levels.findIndex(
      (level) => level.scaleFactor === factor
    )
    if (index < 0) return
    if (levelKey) {
      const level = source.levels[index + (event.key === '[' ? -1 : 1)]
      if (!level) return
      if (game) {
        gameControls?.focusLevel(level)
        return
      }
      const flight = selectLevel(level)
      const navigation = { level }
      keyboardNavigation = navigation
      void flight?.finally(() => {
        if (keyboardNavigation === navigation) keyboardNavigation = undefined
      })
      return
    }

    const level = source.levels[index]
    const current = keyboardNavigation?.tile ?? (game ? gameGuess : selected)
    const origin = current
      ? tileCenter(current)
      : (viewportCenter(game ? gamePosition : viewport) ?? [
          source.image.width / 2,
          source.image.height / 2
        ])
    const tile = moveTile(
      source,
      tileAtPosition(source, level, origin),
      event.key,
      event
    )
    pyramidView.revealTile(tile)
    if (game) {
      gameControls?.select(tile)
    } else {
      const flight = selectPyramidTile(tile)
      const navigation = { level, tile }
      keyboardNavigation = navigation
      void flight.finally(() => {
        if (keyboardNavigation === navigation) keyboardNavigation = undefined
      })
    }
  }

  async function selectPyramidTile(tile: Tile | undefined) {
    clearSelection()
    if (pyramidOnly && tile) {
      activeFactor = tile.level.scaleFactor
      selected = tile
      return
    }
    if (!tile || !imageView) return
    const [x, y, width, height] = tile.region
    const flight = imageView.focusLevel(tile.level, [
      x + width / 2,
      y + height / 2
    ])
    const pending = { tile, settled: false }
    pendingSelection = pending
    await flight
    // A new click, navigation gesture, or image can supersede this flight.
    if (pendingSelection !== pending) return
    pending.settled = true
    commitSelection()
  }

  function startPositionDrag() {
    positionAction++
    clearSelection()
    positionDragging = true
    imageView?.stopNavigation()
  }

  function cancelPositionDrag() {
    positionAction++
    positionDragging = false
  }

  async function movePosition(level: Level, point: Point) {
    const action = ++positionAction
    clearSelection()
    positionDragging = true
    try {
      await imageView?.focusLevel(level, point)
    } finally {
      if (action === positionAction) positionDragging = false
    }
  }

  function getShareSnapshot(): ShareSnapshot | undefined {
    preserveSharedView = true
    imageView?.stopNavigation()
    pyramidView?.stopNavigation()
    const pyramid = pyramidView?.getExportSnapshot()
    const imageCamera =
      imageView?.getCameraPosition() ??
      initialView?.image ??
      (pyramidOnly ? { center: [0, 0] as Point, zoom: 0 } : undefined)
    const pyramidCamera = pyramidView?.getCameraPosition()
    if (!pyramid || !imageCamera || !pyramidCamera) return
    return {
      pyramid,
      view: {
        image: imageCamera,
        pyramid: pyramidCamera,
        level: activeFactor,
        focusedLevel: pyramidView?.getFocusedLevel(),
        layout,
        split,
        tilt: tiltDirection,
        pyramidLayout,
        grid,
        figure: showPositionFigure,
        sync: syncMode
      }
    }
  }

  function setLayout(next: 'split' | 'image' | 'pyramid') {
    if (next !== 'split') fullView = next
    layout = next
  }

  function resize(event: PointerEvent) {
    if (!resizing) return
    const box = workspace.getBoundingClientRect()
    const fraction = stacked
      ? (event.clientY - box.top) / box.height
      : (event.clientX - box.left) / box.width
    split = Math.max(25, Math.min(75, fraction * 100))
  }

  $effect.pre(() => {
    if (!mounted || game === previousGame) return
    previousGame = game
    untrack(() => {
      hovered = undefined
      preserveSharedView = true
      clearSelection()
      cancelPositionDrag()
      imageView?.stopNavigation()
      pyramidView?.stopNavigation()
      inputDialog.close()
      gameGuess = undefined
      gameAnswer = undefined
      gameGrid = true
    })
  })

  $effect(() => {
    gameFramed = false
    if (!game || !source || !pyramidView) return
    const view = pyramidView
    const topLevel = source.levels[0]
    const topTile = tileAtPosition(source, topLevel, [
      source.image.width / 2,
      source.image.height / 2
    ])
    const request = new AbortController()
    // Commit the final panel size before waiting for MapLibre's own resize and
    // redraw. Frame before waiting for tiles: entering during a source-change
    // flight may stop the camera outside the new pyramid, with no tiles to load.
    void untrack(async () => {
      await tick()
      await view.fitAfterResize(request.signal, topLevel, tileCenter(topTile))
      if (!request.signal.aborted) gameFramed = true
    })
    return () => {
      request.abort()
    }
  })

  afterNavigate(({ from, to }) => {
    if (!from || !to || !source) return
    // Route changes for the same source reuse the maps. A new source URL still
    // loads normally, including when reached with the browser's Back button.
    const current = sourceUrl(to.url.href, source)
    const params = to.url.searchParams
    if (
      sourceInput(params) !== sourceInput(current.searchParams) ||
      params.get('canvas') !== current.searchParams.get('canvas') ||
      params.has('canvas-index')
    ) {
      input = sourceInput(params)
      void open(input, readSharedView(to.url.hash), {
        canvas: params.get('canvas'),
        canvasIndex: params.get('canvas-index')
      })
    }
  })

  onMount(() => {
    previousGame = game
    mounted = true
    const media = matchMedia('(max-width: 720px)')
    const updateOrientation = () => {
      stacked = media.matches
    }
    updateOrientation()
    media.addEventListener('change', updateOrientation)
    baseHref = location.href
    const params = new URL(location.href).searchParams
    input = sourceInput(params)
    void open(input, readSharedView(location.hash), {
      canvas: params.get('canvas'),
      canvasIndex: params.get('canvas-index')
    })
    return () => {
      controller?.abort()
      media.removeEventListener('change', updateOrientation)
    }
  })
</script>

<svelte:window
  onhashchange={() => {
    const shared = readSharedView(location.hash)
    if (shared)
      void open(sourceInput(new URL(location.href).searchParams), shared)
  }}
  onpointermove={resize}
  onpointerup={() => {
    resizing = false
  }}
  onpointercancel={() => {
    resizing = false
  }}
  onkeydown={keydown}
/>

<div
  class="pyramid-app explorer-app"
  class:resizing
  class:embedded={!!embed}
  class:game-app={game}
  class:game-mode={game}
  class:pyramid-only={pyramidOnly}
>
  {#if !game}
    <div class="viewer-chrome">
      <div class="viewer-identity" data-overlay-obstacle>
        <a
          class="brand"
          href={embed
            ? source
              ? sourceUrl(baseHref, source, `${base}/`).href
              : `${base}/`
            : 'https://allmaps.org'}
          target="_blank"
          rel="noreferrer"
          title={embed ? 'Open in Allmaps IIIF Pyramid' : 'Allmaps'}
          aria-label="Allmaps IIIF Pyramid"
        >
          <img src={logo} alt="" width="32" height="32" /><span
            ><strong>Allmaps</strong> IIIF Pyramid</span
          >
        </a>
        {#if !embed || embed.header}
          <ResourceControl
            {source}
            {manifest}
            {loading}
            onopen={() => inputDialog.showModal()}
            oncanvas={(canvas) =>
              void open(manifest!.url, undefined, {}, canvas)}
          />
        {/if}
      </div>
      <nav
        class="viewer-tools"
        data-overlay-obstacle
        aria-label="Pyramid actions"
      >
        {#if !pyramidOnly && (!embed || embed.controls)}
          <button
            class="quiet-button"
            aria-label="Full view"
            aria-pressed={layout !== 'split'}
            title={layout === 'split'
              ? 'Switch to full view'
              : 'Switch to split view'}
            onclick={() => setLayout(layout === 'split' ? fullView : 'split')}
          >
            {#if layout === 'split'}<ArrowsOutSimple size={20} />{:else}<Columns
                size={20}
              />{/if}
          </button>
        {/if}
        {#if !embed || embed.table}<LevelsPanel
            {source}
            {activeFactor}
            activeTileCount={activeTiles.length}
            onlevel={selectLevel}
          />{/if}
        {#if !embed || embed.controls}
          <TiltControl
            value={tiltDirection}
            onchange={(direction) => (tiltDirection = direction)}
            layout={pyramidLayout}
            onlayout={(value) => {
              preserveSharedView = true
              pyramidLayout = value
            }}
            disabled={loading}
            {grid}
            {fillTilesOnHover}
            {showTileDetails}
            ongrid={(value) => (grid = value)}
            onhoverfill={(value) => (fillTilesOnHover = value)}
            ontiledetails={(value) => (showTileDetails = value)}
          />
          {#key source?.url}<PublishMenu
              getSnapshot={getShareSnapshot}
              getPyramidSnapshot={() => pyramidView?.getExportSnapshot()}
              disabled={loading || !source}
            />{/key}
        {/if}
        {#if !embed || embed.header}
          <a
            class="quiet-button"
            href={source
              ? sourceUrl(baseHref, source, `${base}/game/`).href
              : `${base}/game/`}
            aria-label="Play tile hunt"
            title="Play tile hunt"><GameController size={20} /></a
          >
          <About />
        {/if}
      </nav>
    </div>
  {/if}
  {#if notice}<div class="source-notice" role="status">
      {notice}<button
        class="icon-button"
        aria-label="Dismiss source notice"
        onclick={() => (notice = '')}><X size={16} /></button
      >
    </div>{/if}
  <main
    class="workspace"
    aria-keyshortcuts="[ ] ArrowLeft ArrowRight ArrowUp ArrowDown"
    class:split={layout === 'split'}
    class:image-main={layout === 'image'}
    class:pyramid-main={layout === 'pyramid'}
    style:--split={`${split}%`}
    bind:this={workspace}
  >
    {#if source}
      {#if !pyramidOnly}<section
          class="view-panel image-panel"
          aria-label="Image viewer"
          inert={game}
          aria-hidden={game}
          use:floatingPanel={{
            enabled: !game && layout === 'pyramid',
            placement: insetPlacement
          }}
        >
          <MapSurface
            bind:this={imageView}
            {source}
            kind="image"
            {fillTilesOnHover}
            hoveredTile={hovered?.tile}
            onhover={(tile) => hoverTile('image', tile)}
            initialCamera={initialView?.image}
            {initialRegion}
            controls={embed?.controls ?? true}
            minimaps={(embed?.minimaps ?? true) &&
              !game &&
              layout !== 'pyramid'}
            scrollZoom={embed?.scrollZoom ?? true}
            {grid}
            {viewport}
            {activeFactor}
            {activeTiles}
            {selected}
            onmanual={() => startNavigation('image')}
            onview={viewChanged}
            onmoving={imageMotionChanged}
            onselect={(tile) => {
              clearSelection()
              selected = tile
            }}
            onerror={(message) => (error = message)}
          />
          <div class="panel-toolbar">
            <h1 class="sr-only">Image</h1>
            {#if !embed || embed.controls}<ViewLayoutControls
                view="image"
                {layout}
                onchange={setLayout}
              />{/if}
          </div>
        </section>{/if}
      {#if layout === 'split' && !game && !pyramidOnly}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (WAI-ARIA window splitter with keyboard resizing.) -->
        <div
          class="split-handle"
          role="separator"
          tabindex="0"
          aria-orientation={stacked ? 'horizontal' : 'vertical'}
          aria-label="Resize views"
          aria-valuemin={25}
          aria-valuemax={75}
          aria-valuenow={Math.round(split)}
          title="Drag to resize · double-click to center"
          onpointerdown={(event) => {
            event.preventDefault()
            resizing = true
            event.currentTarget.focus()
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          ondblclick={() => (split = 50)}
          onkeydown={(event) => {
            const backward = stacked ? 'ArrowUp' : 'ArrowLeft',
              forward = stacked ? 'ArrowDown' : 'ArrowRight'
            if (
              [backward, forward, 'Home', 'End', 'Enter'].includes(event.key)
            ) {
              event.preventDefault()
              split =
                event.key === 'Home'
                  ? 25
                  : event.key === 'End'
                    ? 75
                    : event.key === 'Enter'
                      ? 50
                      : Math.max(
                          25,
                          Math.min(
                            75,
                            split + (event.key === backward ? -3 : 3)
                          )
                        )
            }
          }}
        >
          <ArrowsHorizontal size={20} />
        </div>
      {/if}
      <section
        class="view-panel pyramid-panel"
        class:game-pyramid={game}
        aria-label={game ? 'Game pyramid' : 'Tile pyramid'}
        use:floatingPanel={{
          enabled: !game && !pyramidOnly && layout === 'image',
          placement: insetPlacement
        }}
      >
        <MapSurface
          bind:this={pyramidView}
          {source}
          kind="pyramid"
          {fillTilesOnHover}
          hoveredTile={hovered?.tile}
          onhover={(tile) => hoverTile('pyramid', tile)}
          initialCamera={initialView?.pyramid}
          initialFocusedLevel={initialView?.focusedLevel}
          controls={embed?.controls ?? true}
          minimaps={(embed?.minimaps ?? true) && (game || layout !== 'image')}
          scrollZoom={embed?.scrollZoom ?? true}
          {tiltDirection}
          pyramidLayout={game ? 'adjacent' : pyramidLayout}
          showPositionFigure={game || showPositionFigure}
          figurePlacement={game}
          outfit={game ? hunterOutfit : undefined}
          figureInteractive={!game || gameCanPlace}
          {figureVariant}
          {figurePalette}
          grid={game ? gameGrid : grid}
          viewport={game || pyramidOnly ? undefined : viewport}
          positionViewport={game
            ? gamePosition
            : pyramidOnly
              ? undefined
              : settledViewport}
          positionFactor={game
            ? (gameGuess?.level.scaleFactor ?? gameFactor)
            : settledFactor}
          linked={game || pyramidOnly ? undefined : syncMode !== 'none'}
          onfollow={toggleFollowing}
          followPaused={!game && imageMoving}
          activeFactor={game ? gameFactor : activeFactor}
          activeTiles={game || pyramidOnly ? [] : activeTiles}
          selected={game ? gameGuess : selected}
          answer={game ? gameAnswer : undefined}
          follow={!game &&
            syncMode === 'image-to-pyramid' &&
            !preserveSharedView &&
            !positionDragging &&
            drivingView === 'image'}
          onmanual={() => {
            if (game) gameControls?.cancelCenter()
            startNavigation('pyramid')
          }}
          onready={() => (pyramidReady = true)}
          onselect={(tile) =>
            game ? gameControls?.select(tile) : selectPyramidTile(tile)}
          onlevel={(level) =>
            game ? gameControls?.focusLevel(level) : selectLevel(level)}
          onpositionstart={game ? undefined : startPositionDrag}
          onpositioncancel={game ? undefined : cancelPositionDrag}
          onpositiondrop={game
            ? async (level, point) => {
                gameControls?.place(level, point)
              }
            : movePosition}
          onfigurechange={game || pyramidOnly
            ? undefined
            : (visible) => (showPositionFigure = visible)}
          onerror={(message) => (error = message)}
        />
        <div class="panel-toolbar">
          <h2 class="sr-only">Tile pyramid</h2>
          {#if !game && !pyramidOnly && (!embed || embed.controls)}<ViewLayoutControls
              view="pyramid"
              {layout}
              onchange={setLayout}
            />{/if}
        </div>
      </section>
    {:else}
      <div class="empty-state">
        {#if loading}
          <Loading />
        {:else}
          <h1>Open an IIIF image</h1>
          <button class="primary-button" onclick={() => inputDialog.showModal()}
            >Open an image</button
          >
        {/if}
      </div>
    {/if}

    {#if showTileDetails && selected && !game}
      <aside class="tile-inspector" aria-label="Selected tile">
        <div class="inspector-title">
          <span>Tile details</span><button
            class="icon-button"
            aria-label="Close tile details"
            onclick={clearSelection}><X size={17} /></button
          >
        </div>
        <div class="tile-preview">
          <img
            src={selected.url}
            alt={`Tile at column ${selected.column + 1}, row ${selected.row + 1}`}
          />
          <div>
            <strong
              >Column {selected.column + 1} · Row {selected.row + 1}</strong
            ><span>Resolution 1:{selected.level.scaleFactor}</span><span
              >{selected.size.join(' × ')} px</span
            >
          </div>
        </div>
        <dl>
          <dt>Source region</dt>
          <dd>{selected.region.map(number).join(', ')}</dd>
          <dt>Region size</dt>
          <dd>
            {number(selected.region[2])} × {number(selected.region[3])} px
          </dd>
        </dl>
        <a
          class="tile-link"
          href={selected.url}
          target="_blank"
          rel="noreferrer"
          >Open original IIIF tile <ArrowSquareOut size={16} /></a
        >
      </aside>
    {/if}
  </main>

  {#if game && source && !embed}<Game
      bind:this={gameControls}
      active={game}
      {source}
      {manifest}
      map={pyramidView}
      ready={pyramidReady && gameFramed}
      {loading}
      bind:activeFactor={gameFactor}
      bind:guess={gameGuess}
      bind:answer={gameAnswer}
      bind:canPlace={gameCanPlace}
      grid={gameGrid}
      ontogglegrid={() => (gameGrid = !gameGrid)}
      exitHref={sourceUrl(baseHref, source, `${base}/`).href}
      onopen={() => inputDialog.showModal()}
      oncanvas={(canvas, signal) =>
        open(manifest!.url, undefined, {}, canvas, signal)}
    />{/if}

  {#if error}
    <div class="error-banner" role="alert">
      <span>{error}</span><button
        class="icon-button"
        aria-label="Retry image loading"
        title="Retry"
        onclick={() => open()}><ArrowClockwise size={18} /></button
      ><button
        class="icon-button"
        aria-label="Dismiss error"
        onclick={() => (error = '')}><X size={18} /></button
      >
    </div>
  {/if}
</div>

<dialog
  use:dismissOnBackdrop
  bind:this={inputDialog}
  class="source-dialog"
  class:game-mode={game}
  onclose={() => {
    // Native dialogs restore their opener's focus. Leave the navigator idle
    // after choosing a resource; keyboard tab navigation still has its outline.
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.closest('.resource-control')
    )
      document.activeElement.blur()
  }}
>
  <div class="dialog-title">
    <h2>Open IIIF content</h2>
    <button
      class="icon-button"
      aria-label="Close image chooser"
      onclick={() => inputDialog.close()}><X size={20} /></button
    >
  </div>
  {#if source}<p class="source-current" aria-label="Loaded resource">
      {source.title}
    </p>{/if}
  {#if manifest}
    <label class="source-canvas-picker">
      Canvas
      <select
        aria-label="Choose manifest canvas"
        disabled={loading}
        value={source?.presentation?.canvasId}
        onchange={(event) => {
          const canvas = manifest!.canvases.find(
            (item) => item.id === event.currentTarget.value
          )
          if (canvas) void open(manifest!.url, undefined, {}, canvas)
        }}
      >
        {#each manifest.canvases as canvas, i}<option value={canvas.id}
            >{i + 1}. {canvas.label}</option
          >{/each}
      </select>
    </label>
  {/if}
  <p>Open an image service, a manifest, or a IIIF Content State.</p>
  <form
    onsubmit={(event) => {
      event.preventDefault()
      void open()
    }}
  >
    <label for="image-url">IIIF URL or Content State</label>
    <div class="url-input">
      <input
        id="image-url"
        type="text"
        spellcheck="false"
        bind:value={input}
        aria-invalid={!!error}
        aria-describedby={error ? 'source-error' : undefined}
        required
        placeholder="https://…/info.json"
      /><button class="primary-button" type="submit" disabled={loading}
        >{loading ? 'Loading…' : 'Open'}</button
      >
    </div>
    {#if error}<p id="source-error" class="dialog-error" role="alert">
        {error}
      </p>{/if}
    <span class="input-hint"
      >Image info.json, Presentation 2/3 manifest, or plain/encoded Content
      State JSON.</span
    >
  </form>
  <div class="examples-heading">Or start exploring</div>
  <div class="examples">
    {#each sourceExamples as example, i}
      <button
        onclick={() => {
          input = new URL(example.url, location.href).href
          void open(input)
        }}
        disabled={loading}
        ><span class="example-number">0{i + 1}</span><span
          ><strong>{example.title}</strong><small>{example.collection}</small
          ></span
        ><span class="example-arrow">↗</span></button
      >
    {/each}
  </div>
</dialog>
