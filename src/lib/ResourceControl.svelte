<script lang="ts">
  import { CaretDown, CaretLeft, CaretRight, FolderOpen } from 'phosphor-svelte'
  import type { ImageSource } from './iiif'
  import type { ManifestSource, CanvasChoice } from './iiif-source'

  let {
    source,
    manifest,
    loading = false,
    onopen,
    oncanvas
  }: {
    source?: ImageSource
    manifest?: ManifestSource
    loading?: boolean
    onopen: () => void
    oncanvas: (canvas: CanvasChoice) => void
  } = $props()
  const title = $derived(source?.title ?? 'Open IIIF content')
  const index = $derived(
    manifest?.canvases.findIndex(
      (canvas) => canvas.id === source?.presentation?.canvasId
    ) ?? -1
  )
</script>

<div
  class="resource-control"
  role="group"
  aria-label="Loaded IIIF resource"
  aria-busy={loading}
>
  <button
    class="source-button"
    aria-label={`Open IIIF content: ${title}`}
    aria-haspopup="dialog"
    title={`${title} · Open a IIIF image or manifest`}
    onclick={onopen}
  >
    <span class="source-open-icon"><FolderOpen size={18} /></span>
    <span class="source-title">{title}</span>
    <span class="source-caret"><CaretDown size={18} /></span>
  </button>
  {#if manifest}
    <div
      class="resource-pages"
      role="group"
      aria-label="Manifest pages"
      style:--canvas-digits={String(manifest.canvases.length).length}
    >
      <button
        class="resource-page-button"
        aria-label="Previous canvas"
        title="Previous canvas"
        disabled={loading || index <= 0}
        onclick={() => oncanvas(manifest!.canvases[index - 1])}
        ><CaretLeft size={18} /></button
      >
      <div class="resource-canvas" title={manifest.canvases[index]?.label}>
        <span class="resource-count" aria-hidden="true"
          ><span class="canvas-number">{index < 0 ? '–' : index + 1}</span> /
          <span class="canvas-number">{manifest.canvases.length}</span
          ><CaretDown size={14} /></span
        >
        <select
          aria-label="Manifest canvas"
          value={source?.presentation?.canvasId}
          disabled={loading}
          onchange={(event) => {
            const canvas = manifest!.canvases.find(
              (canvas) => canvas.id === event.currentTarget.value
            )
            if (canvas) oncanvas(canvas)
          }}
        >
          {#each manifest.canvases as canvas, i}
            <option value={canvas.id}>{i + 1}. {canvas.label}</option>
          {/each}
        </select>
      </div>
      <button
        class="resource-page-button"
        aria-label="Next canvas"
        title="Next canvas"
        disabled={loading ||
          index < 0 ||
          index === manifest.canvases.length - 1}
        onclick={() => oncanvas(manifest!.canvases[index + 1])}
        ><CaretRight size={18} /></button
      >
    </div>
  {/if}
</div>
