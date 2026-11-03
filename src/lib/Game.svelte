<script lang="ts">
  import { onMount, onDestroy, tick, untrack } from 'svelte'
  import { dismissOnBackdrop } from './dismiss-on-backdrop'
  import { floatingPanel } from './floating-panel'
  import {
    ArrowLeft,
    ArrowRight,
    ArrowClockwise,
    SkipForward,
    Timer,
    Trophy,
    CrosshairSimple,
    Question,
    DotsSix,
    GameController,
    GridFour,
    X
  } from 'phosphor-svelte'
  import type MapSurface from './MapSurface.svelte'
  import ResourceControl from './ResourceControl.svelte'
  import type { ManifestSource, CanvasChoice } from './iiif-source'
  import logo from './images/allmaps-logo.svg'
  import type { ImageSource, Tile, Level } from './iiif'
  import { moveTile, tileAtPosition, tileCenter } from './tile-navigation'
  import { controllerLabels, watchGamepad } from './gamepad'
  import type { Controller, GamepadAction } from './gamepad'
  import type { Point } from './geometry'
  import {
    chooseTile,
    nextGameCanvas,
    scoreGuess,
    roundCount,
    difficulties
  } from './game'
  import type { RoundResult, Difficulty } from './game'

  let {
    active,
    source,
    manifest,
    map,
    ready,
    loading,
    exitHref,
    onopen,
    oncanvas,
    grid,
    ontogglegrid,
    canPlace = $bindable(false),
    activeFactor = $bindable(1),
    guess = $bindable<Tile | undefined>(undefined),
    answer = $bindable<Tile | undefined>(undefined)
  }: {
    active: boolean
    source: ImageSource
    manifest?: ManifestSource
    map: MapSurface | undefined
    ready: boolean
    loading: boolean
    exitHref: string
    onopen: () => void
    oncanvas: (
      canvas: CanvasChoice,
      signal?: AbortSignal
    ) => Promise<boolean | undefined>
    grid: boolean
    ontogglegrid: () => void
    canPlace?: boolean
    activeFactor?: number
    guess?: Tile
    answer?: Tile
  } = $props()
  let target = $state.raw<Tile>()
  let results = $state<
    (RoundResult | { skipped: true; total: 0; seconds: number; exact: false })[]
  >([])
  let phase = $state<'guessing' | 'revealed' | 'finished'>('guessing')
  let hintReady = $state(false)
  let hintError = $state(false)
  let elapsed = $state(0)
  let scoreDialog: HTMLDialogElement
  let helpDialog: HTMLDialogElement
  let helpOpen = $state(true)
  let introSeen = $state(false)
  let hideInstructions = $state(false)
  const instructionsPreference = 'allmaps-iiif-tile-hunt-hide-instructions'
  let difficulty = $state<Difficulty>('challenging')
  let nextDifficulty = $state<Difficulty>('challenging')
  let controller = $state<Controller>()
  const controllerReady = $derived(controller?.mapping === 'standard')
  const buttons = $derived(controllerLabels(controller?.id ?? ''))
  let start: number | undefined
  let celebration: AbortController | undefined
  let centerTimer: ReturnType<typeof setTimeout> | undefined
  let framingRound = $state(false)
  let disposed = false
  let navigation = 0
  const usedTiles = new Map<string, Set<string>>()
  const visited = new Set<string>()
  let rotation: { canvas: CanvasChoice; request: AbortController } | undefined
  const total = $derived(results.reduce((sum, result) => sum + result.total, 0))
  const playing = $derived(
    active &&
      phase === 'guessing' &&
      hintReady &&
      ready &&
      !loading &&
      !framingRound &&
      !helpOpen
  )

  function showHelp() {
    cancelCenter()
    nextDifficulty = difficulty
    helpOpen = true
    helpDialog.showModal()
  }

  function startHunting() {
    if (nextDifficulty !== difficulty) {
      difficulty = nextDifficulty
      restart()
    }
    helpDialog.close()
  }

  function rememberInstructions(hidden: boolean) {
    hideInstructions = hidden
    try {
      localStorage.setItem(instructionsPreference, String(hidden))
    } catch {
      // Storage can be unavailable in private or embedded contexts.
    }
  }

  export function confirm() {
    if (helpDialog.open) startHunting()
    else if (scoreDialog.open) restart()
    else if (!document.querySelector('dialog[open]')) {
      if (phase === 'guessing') submit()
      else if (phase === 'revealed') advance()
      else scoreDialog.showModal()
    }
  }

  function dialogKeydown(event: KeyboardEvent) {
    event.stopPropagation()
    if (
      event.key !== 'Enter' ||
      event.isComposing ||
      (event.target instanceof HTMLElement &&
        event.target.closest('input, select, textarea'))
    )
      return
    event.preventDefault()
    if (!event.repeat) confirm()
  }

  function startClock() {
    if (playing && start === undefined)
      start = performance.now() - elapsed * 1000
  }
  function nextRound(fit = true) {
    cancelCenter()
    navigation++
    celebration?.abort()
    const canvasId = source.presentation?.canvasId
    if (canvasId) visited.add(canvasId)
    const key = canvasId ?? source.url
    const used = usedTiles.get(key) ?? new Set<string>()
    usedTiles.set(key, used)
    target = chooseTile(source, used, difficulty)
    used.add(target.key)
    guess = tileAtPosition(source, source.levels[0], [
      source.image.width / 2,
      source.image.height / 2
    ])
    answer = undefined
    phase = 'guessing'
    hintReady = false
    hintError = false
    start = undefined
    elapsed = 0
    activeFactor = source.levels[0].scaleFactor
    framingRound = fit
    if (fit) {
      const round = target
      void tick().then(async () => {
        if (disposed || target !== round) return
        await map?.focusLevel(source.levels[0], tileCenter(guess!), true)
        if (!disposed && target === round) framingRound = false
      })
    }
  }
  function restart(fit = true) {
    scoreDialog?.close()
    results = []
    rotation?.request.abort()
    rotation = undefined
    usedTiles.clear()
    visited.clear()
    nextRound(fit)
  }
  export function submit() {
    if (!target || !guess || !playing || start === undefined) return
    cancelCenter()
    navigation++
    elapsed = (performance.now() - start) / 1000
    const result = scoreGuess(target, guess, elapsed)
    results = [...results, result]
    start = undefined
    phase = 'revealed'
    answer = target
    activeFactor = target.level.scaleFactor
    void map?.focusComparison(guess, target)
    if (result.exact) {
      celebration = new AbortController()
      void map?.celebratePosition(celebration.signal)
    }
  }
  async function advance() {
    if (rotation || loading || phase === 'finished') return
    if (results.length === roundCount) {
      phase = 'finished'
      scoreDialog.showModal()
      return
    }
    const canvas =
      manifest &&
      source.presentation &&
      nextGameCanvas(manifest.canvases, source.presentation.canvasId, visited)
    if (!canvas) {
      nextRound()
      return
    }
    const request = new AbortController()
    rotation = { canvas, request }
    const loaded = await oncanvas(canvas, request.signal)
    if (!loaded && !disposed && rotation?.request === request) {
      rotation = undefined
      nextRound()
    }
  }
  export function skip() {
    if (
      !target ||
      phase !== 'guessing' ||
      helpOpen ||
      loading ||
      !ready ||
      framingRound
    )
      return
    cancelCenter()
    navigation++
    celebration?.abort()
    const seconds =
      start === undefined ? elapsed : (performance.now() - start) / 1000
    start = undefined
    results = [...results, { skipped: true, total: 0, seconds, exact: false }]
    advance()
  }
  export function select(tile: Tile | undefined, delay = 180) {
    if (!playing || !tile) return
    cancelCenter()
    map?.stopNavigation()
    navigation++
    guess = tile
    activeFactor = tile.level.scaleFactor
    // Let repeated stick/key movement finish before recentering, so the camera
    // makes one flight instead of repeatedly restarting while the figure moves.
    centerTimer = setTimeout(() => {
      centerTimer = undefined
      if (!disposed && playing && guess?.key === tile.key) map?.centerTile(tile)
    }, delay)
  }
  export function cancelCenter() {
    clearTimeout(centerTimer)
    centerTimer = undefined
  }
  export function place(level: Level, point: Point) {
    select(tileAtPosition(source, level, point))
  }
  export async function focusLevel(level: Level) {
    if (!playing) return
    cancelCenter()
    const action = ++navigation
    if (guess) guess = tileAtPosition(source, level, tileCenter(guess))
    activeFactor = level.scaleFactor
    await tick()
    if (!disposed && action === navigation)
      await map?.focusLevel(level, guess ? tileCenter(guess) : undefined)
  }

  export function moveGuess(key: string, modifiers = {}) {
    if (!playing) return
    const level = source.levels.find(
      (level) => level.scaleFactor === activeFactor
    )
    if (!level) return
    const tile = moveTile(
      source,
      guess ??
        tileAtPosition(source, level, [
          source.image.width / 2,
          source.image.height / 2
        ]),
      key,
      modifiers
    )
    // Stay beyond the controller's initial repeat delay as well as key repeat.
    select(tile, 360)
  }

  function gamepadContext() {
    if (!active) return 'blocked'
    if (helpDialog?.open) return 'help'
    if (scoreDialog?.open) return 'score'
    if (document.querySelector('dialog[open]')) return 'modal'
    if (
      document.querySelector(
        '[popover]:popover-open, [role=menu], .moving-overlay, .position-marker.dragging, .figure-control.dragging'
      ) ||
      document.activeElement?.matches(
        'input, textarea, select, [contenteditable="true"]'
      )
    )
      return 'blocked'
    return `${ready && !loading ? phase : 'loading'}-${results.length}`
  }

  function gamepadInput(
    next: Controller | undefined,
    actions: GamepadAction[]
  ) {
    if (
      controller?.id !== next?.id ||
      controller?.index !== next?.index ||
      controller?.mapping !== next?.mapping
    )
      controller = next
    const modal = document.querySelector<HTMLDialogElement>('dialog[open]')
    const camera =
      !modal &&
      ready &&
      !loading &&
      actions.find((action) => action.type === 'camera')
    if (camera) cancelCenter()
    map?.driveCamera(camera ? camera.pan : [0, 0], camera ? camera.zoom : 0)
    for (const action of actions) {
      if (action.type === 'back') {
        if (modal) modal.close()
        return
      }
      if (action.type === 'help') {
        if (modal === helpDialog) helpDialog.close()
        else if (!modal) showHelp()
        return
      }
      if (action.type === 'confirm') {
        confirm()
        return
      }
      if (
        modal === helpDialog &&
        action.type === 'move' &&
        (action.key === 'ArrowLeft' || action.key === 'ArrowRight')
      ) {
        const index = difficulties.findIndex(
          (item) => item.id === nextDifficulty
        )
        nextDifficulty =
          difficulties[
            Math.max(
              0,
              Math.min(
                difficulties.length - 1,
                index + (action.key === 'ArrowRight' ? 1 : -1)
              )
            )
          ].id
      }
      if (modal || !ready || loading) continue
      if (action.type === 'grid') ontogglegrid()
      else if (action.type === 'move') moveGuess(action.key)
      else if (action.type === 'level' && playing) {
        const index = source.levels.findIndex(
          (level) => level.scaleFactor === activeFactor
        )
        const level = source.levels[index + action.direction]
        if (level) focusLevel(level)
      } else if (action.type === 'overview') {
        cancelCenter()
        map?.fitToView()
      } else if (action.type === 'locate') {
        cancelCenter()
        if (phase === 'revealed' && guess && target)
          map?.focusComparison(guess, target)
        else if (guess) map?.focusLevel(guess.level, tileCenter(guess))
      }
    }
  }
  $effect(() => {
    source
    untrack(() => {
      if (
        rotation &&
        source.presentation?.canvasId === rotation.canvas.id &&
        manifest?.canvases.includes(rotation.canvas)
      ) {
        rotation = undefined
        nextRound(false)
      } else restart(false)
    })
  })
  $effect(() => {
    const running = playing
    canPlace = running
    untrack(() => {
      if (running) startClock()
      else if (start !== undefined) {
        elapsed = (performance.now() - start) / 1000
        start = undefined
      }
    })
  })
  $effect(() => {
    if (!active) scoreDialog?.close()
  })
  onMount(() => {
    try {
      hideInstructions = localStorage.getItem(instructionsPreference) === 'true'
    } catch {
      // Keep the introduction available when storage is unavailable.
    }
    if (hideInstructions) {
      helpOpen = false
      introSeen = true
    } else showHelp()
    const stopGamepad = watchGamepad(gamepadContext, gamepadInput)
    const timer = setInterval(() => {
      if (playing && start !== undefined)
        elapsed = (performance.now() - start) / 1000
    }, 250)
    return () => {
      clearInterval(timer)
      stopGamepad()
      map?.driveCamera([0, 0], 0)
    }
  })
  onDestroy(() => {
    disposed = true
    rotation?.request.abort()
    cancelCenter()
    celebration?.abort()
  })
</script>

{#if active}
  <div class="game-chrome">
    <div class="game-identity" data-overlay-obstacle>
      <a class="brand" href={exitHref} aria-label="Allmaps IIIF Tile Hunt">
        <img src={logo} alt="" width="32" height="32" />
        <span><strong>Allmaps</strong> IIIF Tile Hunt</span>
      </a>
      <ResourceControl {source} {manifest} {loading} {onopen} {oncanvas} />
    </div>
    <nav class="game-tools" data-overlay-obstacle aria-label="Game actions">
      <span class="game-total" title="Total score"
        ><Trophy size={17} />{total.toLocaleString()}</span
      >
      <button
        class="quiet-button"
        title={`Show or hide tile grid · B${controllerReady ? ` / ${buttons.grid}` : ''}`}
        aria-label="Show tile grid"
        aria-pressed={grid}
        onclick={ontogglegrid}
      >
        <GridFour size={20} />
      </button>
      <button
        class="quiet-button"
        title={controllerReady
          ? 'How to play · controller connected'
          : 'How to play'}
        aria-label="How to play"
        aria-haspopup="dialog"
        onclick={showHelp}
        >{#if controllerReady}<GameController size={20} />{:else}<Question
            size={20}
          />{/if}</button
      >
      <a
        class="quiet-button"
        title="Return to explorer"
        aria-label="Return to explorer"
        href={exitHref}><ArrowLeft size={20} /></a
      >
    </nav>
  </div>

  {#if target && phase !== 'finished'}
    <aside
      class="game-tile-overlay"
      aria-label="Tile to locate"
      use:floatingPanel={true}
    >
      <div class="game-tile-meta">
        <button
          class="overlay-drag-handle overlay-title quiet-button"
          data-drag-handle
          aria-label="Move tile card"
          title="Drag to move tile · arrow keys to move"
        >
          <DotsSix size={18} />
          <span
            >Tile {Math.min(
              results.length + (phase === 'guessing' ? 1 : 0),
              roundCount
            )} / {roundCount}</span
          >
        </button>
        <span class="game-timer" aria-label="Elapsed time"
          ><Timer size={14} />{elapsed.toFixed(1)}s</span
        >
      </div>
      <div class="game-hint" aria-busy={!hintReady}>
        {#key target}
          <img
            draggable="false"
            data-drag-handle
            src={target.url}
            alt="The tile to find in the pyramid"
            onload={() => {
              hintReady = true
              startClock()
            }}
            onerror={() => (hintError = true)}
          />
        {/key}
        {#if hintError}
          <div class="game-hint-status">
            <p>Tile could not load.</p>
            <button
              class="secondary-button"
              onclick={() => {
                if (target) {
                  hintError = false
                  target = { ...target }
                }
              }}>Retry</button
            >
            <button class="secondary-button" onclick={() => nextRound()}
              >Another tile</button
            >
          </div>
        {:else if !hintReady}<span class="spinner game-hint-status"></span>{/if}
      </div>
    </aside>
  {/if}

  <div class="game-bottom-controls" data-overlay-obstacle>
    {#if phase === 'guessing'}
      <p class="game-selection" aria-live="polite">
        {guess
          ? `1:${guess.level.scaleFactor} · column ${guess.column + 1}, row ${guess.row + 1}`
          : 'Place the figure'}
      </p>
      <button
        class="game-skip secondary-button"
        title="Skip tile · S · 0 points"
        disabled={loading || !ready || helpOpen || framingRound}
        onclick={skip}><SkipForward size={18} />Skip</button
      >
      <button
        class="primary-button"
        disabled={!guess || !playing}
        onclick={submit}
      >
        Submit guess <ArrowRight size={18} />
      </button>
    {:else if phase === 'revealed' && target}
      {@const result = results[results.length - 1]}
      {#if !('skipped' in result)}
        <div class="game-round-result" role="status">
          <strong
            title={`${result.accuracyPoints} accuracy + ${result.speedPoints} speed`}
            >+{result.total} pts</strong
          >
          <span
            >{result.exact
              ? 'Exact tile!'
              : `1:${target.level.scaleFactor} · column ${target.column + 1}, row ${target.row + 1}`}</span
          >
        </div>
        {#if !result.exact}<div
            class="game-vector-legend"
            aria-label="Vector legend"
          >
            <span class="legend-position">Position</span>
            {#if guess?.level.scaleFactor !== target.level.scaleFactor}<span
                class="legend-resolution">Resolution</span
              >{/if}
          </div>{/if}
        <div class="game-result-actions">
          <button
            class="quiet-button"
            title="Show connection"
            aria-label="Show connection"
            onclick={() =>
              target && guess && map?.focusComparison(guess, target)}
            ><CrosshairSimple size={20} /></button
          >
          <button class="primary-button" onclick={advance} disabled={loading}
            >{results.length === roundCount
              ? 'See score'
              : 'Next tile'}<ArrowRight size={18} /></button
          >
        </div>
      {/if}
    {:else}
      <button class="primary-button" onclick={() => scoreDialog.showModal()}
        ><Trophy size={18} />View score</button
      >
    {/if}
  </div>
{/if}

<dialog
  bind:this={scoreDialog}
  use:dismissOnBackdrop
  class="game-score-dialog"
  aria-labelledby="game-score-title"
  onkeydown={dialogKeydown}
>
  <div class="dialog-title">
    <h2 id="game-score-title">Your score</h2>
    <button
      class="icon-button"
      aria-label="Close score"
      onclick={() => scoreDialog.close()}><X size={20} /></button
    >
  </div>
  <p class="game-final-score">
    <Trophy size={28} /><strong>{total.toLocaleString()}</strong><span
      >/ 5,000</span
    >
  </p>
  <table class="game-results">
    <thead><tr><th>Tile</th><th>Time</th><th>Points</th></tr></thead>
    <tbody
      >{#each results as result, i}<tr
          ><td
            >{i + 1}{'skipped' in result
              ? ' · Skipped'
              : result.exact
                ? ' · Exact'
                : ''}</td
          ><td>{result.seconds.toFixed(1)}s</td><td>{result.total}</td></tr
        >{/each}</tbody
    >
  </table>
  <button class="primary-button" onclick={() => restart()}
    ><ArrowClockwise size={18} />Play again</button
  >
</dialog>

<dialog
  bind:this={helpDialog}
  use:dismissOnBackdrop
  class="game-help-dialog"
  aria-labelledby="game-help-title"
  onkeydown={dialogKeydown}
  onclose={() => {
    helpOpen = false
    introSeen = true
  }}
>
  <div class="dialog-title">
    <h2 id="game-help-title">How to play Tile Hunt</h2>
    <button
      class="icon-button"
      aria-label="Close game help"
      onclick={() => helpDialog.close()}><X size={20} /></button
    >
  </div>
  <div class="game-help-content">
    <section class="game-instructions" aria-label="Instructions and difficulty">
      <p>Find the pictured tile in the pyramid and place the figure on it.</p>
      <ol>
        {#if controllerReady}
          <li>
            Move the figure with the left stick or D-pad; change levels with <kbd
              >{buttons.left}</kbd
            >
            / <kbd>{buttons.right}</kbd>.
          </li>
          <li>
            Pan with the right stick, zoom with <kbd>{buttons.out}</kbd> /
            <kbd>{buttons.in}</kbd>, and press
            <kbd class="controller-button">{buttons.confirm}</kbd> to submit.
          </li>
        {:else}
          <li>Pan and zoom to find the right image region and resolution.</li>
          <li>
            Click or tap a tile on any level to place the figure, then choose <strong
              >Submit guess</strong
            >. You can also drag the figure onto a tile.
          </li>
        {/if}
        <li>
          Compare your guess with the answer, then try the next tile.
          {#if manifest && manifest.canvases.length > 1}
            Each new round takes you to a random canvas in this manifest.
          {/if}
        </li>
      </ol>
      <p>
        Five tiles. Up to 1,000 points each for speed and accuracy. The clock
        pauses here. Skipping a tile scores zero points.
      </p>
      {#if controller && !controllerReady}
        <p role="status">
          This controller has no standard button mapping. You can still play
          with the mouse or keyboard.
        </p>
      {/if}
      <div class="game-difficulty">
        <label for="game-difficulty">Difficulty</label>
        <select
          id="game-difficulty"
          bind:value={nextDifficulty}
          aria-describedby="game-difficulty-description"
        >
          {#each difficulties as option}<option value={option.id}
              >{option.label}</option
            >{/each}
        </select>
        <p id="game-difficulty-description">
          {difficulties.find((option) => option.id === nextDifficulty)
            ?.description}
        </p>
      </div>
      <label class="game-instructions-preference">
        <input
          type="checkbox"
          checked={hideInstructions}
          onchange={(event) =>
            rememberInstructions(event.currentTarget.checked)}
        />
        Don't show instructions on startup
      </label>
    </section>
    <section class="game-shortcuts" aria-labelledby="game-shortcuts-title">
      <h3 id="game-shortcuts-title" aria-live="polite">
        {controllerReady ? 'Controller connected' : 'Keyboard shortcuts'}
      </h3>
      {#if controllerReady}
        <dl>
          <div>
            <dt><kbd title="Left stick">LS</kbd> / <kbd>D-pad</kbd></dt>
            <dd>Move one tile (hold to repeat)</dd>
          </div>
          <div>
            <dt><kbd>{buttons.left}</kbd> / <kbd>{buttons.right}</kbd></dt>
            <dd>Coarser / finer level</dd>
          </div>
          <div>
            <dt><kbd title="Right stick">RS</kbd></dt>
            <dd>Pan the pyramid</dd>
          </div>
          <div>
            <dt><kbd class="controller-button">{buttons.grid}</kbd></dt>
            <dd>Show / hide tile grid</dd>
          </div>
          <div>
            <dt><kbd>{buttons.out}</kbd> / <kbd>{buttons.in}</kbd></dt>
            <dd>Zoom out / in</dd>
          </div>
          <div>
            <dt>
              <kbd class="controller-button">{buttons.overview}</kbd> /
              <kbd class="controller-button">{buttons.locate}</kbd>
            </dt>
            <dd>Whole pyramid / find your figure</dd>
          </div>
          <div>
            <dt><kbd class="controller-button">{buttons.confirm}</kbd></dt>
            <dd>Submit / next tile / play again</dd>
          </div>
          <div>
            <dt><kbd>{buttons.help}</kbd></dt>
            <dd>Open or close this help</dd>
          </div>
          <div>
            <dt><kbd class="controller-button">{buttons.back}</kbd></dt>
            <dd>Close popup</dd>
          </div>
          <div>
            <dt><kbd>←</kbd> / <kbd>→</kbd> here</dt>
            <dd>Change difficulty</dd>
          </div>
        </dl>
      {:else}
        <dl>
          <div>
            <dt><kbd>[</kbd> / <kbd>]</kbd></dt>
            <dd>Coarser / finer level</dd>
          </div>
          <div>
            <dt><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></dt>
            <dd>Move one tile</dd>
          </div>
          <div>
            <dt><kbd>Shift</kbd> + arrow</dt>
            <dd>Move ten tiles</dd>
          </div>
          <div>
            <dt><kbd>⌘</kbd> / <kbd>Ctrl</kbd> + arrow</dt>
            <dd>End of row or column</dd>
          </div>
          <div>
            <dt><kbd>+</kbd> / <kbd>−</kbd></dt>
            <dd>Zoom in / out</dd>
          </div>
          <div>
            <dt><kbd>0</kbd></dt>
            <dd>Show the whole pyramid</dd>
          </div>
          <div>
            <dt><kbd>B</kbd></dt>
            <dd>Show / hide tile grid</dd>
          </div>
          <div>
            <dt><kbd>S</kbd></dt>
            <dd>Skip tile (zero points)</dd>
          </div>
          <div>
            <dt><kbd>Enter</kbd></dt>
            <dd>Submit / next tile / play again</dd>
          </div>
          <div>
            <dt><kbd>Esc</kbd></dt>
            <dd>Exit game (close a popup first)</dd>
          </div>
        </dl>
      {/if}
    </section>
  </div>
  <button class="primary-button" onclick={startHunting}>
    {#if controllerReady}<kbd class="controller-button">{buttons.confirm}</kbd
      >{/if}{introSeen
      ? nextDifficulty !== difficulty
        ? 'Start new game'
        : 'Continue'
      : 'Start hunting'}<ArrowRight size={18} />
  </button>
</dialog>
