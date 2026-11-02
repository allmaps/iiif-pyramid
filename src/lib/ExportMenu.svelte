<script lang="ts">
  import { dismissOnBackdrop } from './dismiss-on-backdrop'
  import { onDestroy } from 'svelte'
  import { DownloadSimple, X } from 'phosphor-svelte'
  import { exportFrame, exportFilename } from './export-view'
  import type { ExportOptions, PyramidSnapshot } from './export-view'

  let {
    getSnapshot,
    disabled = false
  }: {
    getSnapshot: () => PyramidSnapshot | undefined
    disabled?: boolean
  } = $props()
  let menu: HTMLDialogElement
  let snapshot = $state.raw<PyramidSnapshot>()
  let area = $state<ExportOptions['area']>('current')
  let resolution = $state(2048)
  let overlays = $state(true)
  let transparent = $state(false)
  let busy = $state(false)
  let progress = $state('')
  let error = $state('')
  let controller: AbortController | undefined
  const frame = $derived(
    snapshot
      ? exportFrame(snapshot.view, snapshot.scene.bounds, { area, resolution })
      : undefined
  )

  export function show() {
    if (disabled) return
    snapshot = getSnapshot()
    if (!snapshot) return
    error = ''
    progress = ''
    menu.showModal()
  }

  async function download() {
    if (!snapshot || busy) return
    const request = new AbortController()
    controller = request
    busy = true
    error = ''
    progress = 'Preparing export…'
    const options = { area, resolution, overlays, transparent }
    try {
      const { exportPyramid } = await import('./export-pyramid')
      request.signal.throwIfAborted()
      const result = await exportPyramid(
        snapshot,
        options,
        request.signal,
        (message) => (progress = message)
      )
      request.signal.throwIfAborted()
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = exportFilename(
        snapshot.source.title,
        area,
        result.width,
        result.height
      )
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      progress = 'PNG downloaded'
    } catch (cause) {
      if (!request.signal.aborted)
        error =
          cause instanceof Error
            ? cause.message
            : 'The export could not be created.'
      progress = ''
    } finally {
      busy = false
      controller = undefined
    }
  }

  onDestroy(() => controller?.abort())
</script>

<dialog
  use:dismissOnBackdrop
  bind:this={menu}
  class="export-menu export-dialog"
  aria-label="Export pyramid"
  onclose={() => {
    controller?.abort()
  }}
>
  <div class="export-title">
    <h3>Export pyramid</h3>
    <button
      class="icon-button"
      aria-label="Close export menu"
      onclick={() => menu.close()}><X size={17} /></button
    >
  </div>
  <form
    onsubmit={(event) => {
      event.preventDefault()
      void download()
    }}
  >
    <fieldset disabled={busy}>
      <legend>Area</legend>
      <div class="export-area">
        <label
          ><input
            type="radio"
            name="export-area"
            value="current"
            bind:group={area}
          />Current view</label
        >
        <label
          ><input
            type="radio"
            name="export-area"
            value="overview"
            bind:group={area}
          />Overview</label
        >
      </div>
      <label class="export-field" for="export-resolution"
        >Resolution <span>Longest side</span></label
      >
      <select id="export-resolution" bind:value={resolution}>
        <option value={1024}>1,024 px · Small</option>
        <option value={2048}>2,048 px · Standard</option>
        <option value={4096}>4,096 px · Large</option>
      </select>
      <label class="export-check"
        ><input type="checkbox" bind:checked={overlays} />Include overlays</label
      >
      <p class="export-hint">Grid, image position, viewport and level labels</p>
      <label class="export-check"
        ><input type="checkbox" bind:checked={transparent} />Transparent
        background</label
      >
    </fieldset>
    <p class="export-dimensions">
      PNG · {frame?.width.toLocaleString('en-US')} × {frame?.height.toLocaleString(
        'en-US'
      )} px
    </p>
    {#if error}<p class="export-error" role="alert">{error}</p>{/if}
    <div class="export-status" role="status" aria-live="polite">{progress}</div>
    <div class="export-actions">
      {#if busy}<button
          type="button"
          class="export-cancel"
          onclick={() => controller?.abort()}>Cancel</button
        >{/if}
      <button class="primary-button" type="submit" disabled={busy || !snapshot}>
        {#if busy}<span class="spinner"></span>Exporting…{:else}<DownloadSimple
            size={16}
          />Download PNG{/if}
      </button>
    </div>
  </form>
</dialog>
