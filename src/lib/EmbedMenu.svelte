<script lang="ts">
  import { base as basePath } from '$app/paths'
  import { dismissOnBackdrop } from './dismiss-on-backdrop'
  import { X, Copy, ArrowSquareOut } from 'phosphor-svelte'
  import { defaultEmbedOptions, embedUrl, embedCode } from './embed-options'
  import type { ShareSnapshot } from './share-view'
  import type { EmbedOptions } from './embed-options'
  let {
    getSnapshot,
    disabled = false
  }: {
    getSnapshot: () => ShareSnapshot | undefined
    disabled?: boolean
  } = $props()
  let dialog: HTMLDialogElement
  let snapshot = $state.raw<ShareSnapshot>()
  let options = $state<EmbedOptions>({ ...defaultEmbedOptions })
  let currentView = $state(true)
  let height = $state(600)
  let base = $state('')
  let message = $state('')
  const url = $derived(
    snapshot
      ? embedUrl(
          base,
          snapshot.pyramid.source,
          options,
          currentView ? snapshot.view : undefined,
          snapshot.pyramid.viewport,
          basePath
        )
      : ''
  )
  const code = $derived(url ? embedCode(url, height) : '')
  const toggles: {
    key: Exclude<keyof EmbedOptions, 'layout' | 'tilt' | 'pyramidLayout'>
    label: string
  }[] = [
    { key: 'header', label: 'Source and app links' },
    { key: 'controls', label: 'View controls' },
    { key: 'minimaps', label: 'Minimaps' },
    { key: 'table', label: 'Zoom table button' },
    { key: 'grid', label: 'Tile grid' },
    { key: 'figure', label: 'Position figure' },
    { key: 'sync', label: 'Image → pyramid sync' },
    { key: 'scrollZoom', label: 'Scroll to zoom' }
  ]
  export function show() {
    if (disabled) return
    snapshot = getSnapshot()
    base = location.href
    message = ''
    if (snapshot)
      options = {
        ...defaultEmbedOptions,
        layout: snapshot.view.layout,
        grid: snapshot.view.grid,
        figure: snapshot.view.figure,
        tilt: snapshot.view.tilt,
        pyramidLayout: snapshot.view.pyramidLayout,
        sync: snapshot.view.sync !== 'none'
      }
    dialog.showModal()
  }
</script>

<dialog
  use:dismissOnBackdrop
  bind:this={dialog}
  class="embed-dialog"
  aria-labelledby="embed-title"
>
  <div class="dialog-title">
    <h2 id="embed-title">Embed this pyramid</h2>
    <button
      class="icon-button"
      aria-label="Close embed"
      onclick={() => dialog.close()}><X size={20} /></button
    >
  </div>
  <p>Add an interactive pyramid to another page.</p>
  {#if snapshot}
    <div class="embed-fields">
      <label
        >Layout<select bind:value={options.layout}
          ><option value="split">Side by side</option><option value="image"
            >Image with pyramid inset</option
          ><option value="pyramid">Pyramid with image inset</option>
          <option value="pyramid-only">Pyramid only · hide image view</option
          ></select
        ></label
      >
      <label
        >Pyramid layout<select
          bind:value={options.pyramidLayout}
          onchange={() => (currentView = false)}
          ><option value="stacked">Stacked</option><option value="adjacent"
            >Adjacent</option
          ></select
        ></label
      >
      <label
        >Tilt<select bind:value={options.tilt}
          ><option value="right">Right</option><option value="left">Left</option
          ></select
        ></label
      >
      <label
        >Height (px)<input
          type="number"
          min="240"
          max="1200"
          step="20"
          bind:value={height}
        /></label
      >
      <label
        >Starting view<select bind:value={currentView}
          ><option
            value={true}
            disabled={options.pyramidLayout !== snapshot.view.pyramidLayout}
            >Current position</option
          ><option value={false}>Overview</option></select
        ></label
      >
    </div>
    <div class="embed-toggles">
      {#each toggles as toggle}<label
          ><input
            type="checkbox"
            bind:checked={options[toggle.key]}
            disabled={options.layout === 'pyramid-only' &&
              (toggle.key === 'sync' || toggle.key === 'figure')}
          />{toggle.label}</label
        >{/each}
    </div>
    <label class="embed-code-label" for="embed-code">Iframe code</label>
    <textarea
      id="embed-code"
      readonly
      value={code}
      rows="4"
      onfocus={(event) => event.currentTarget.select()}></textarea>
    <div class="embed-actions">
      <button
        class="primary-button"
        onclick={async () => {
          try {
            await navigator.clipboard.writeText(code)
            message = 'Embed code copied'
          } catch {
            message = 'Select the code above and copy it with your keyboard.'
          }
        }}><Copy size={17} />Copy code</button
      ><a class="secondary-button" href={url} target="_blank" rel="noreferrer"
        >Open preview <ArrowSquareOut size={17} /></a
      >
    </div>
    <p class="input-hint" role="status">{message}</p>
  {:else}<p>Wait for the image to load, then reopen Embed.</p>{/if}
</dialog>
