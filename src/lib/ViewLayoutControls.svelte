<script lang="ts">
  import { ArrowsOutSimple, DotsSix } from 'phosphor-svelte'
  let {
    view,
    layout,
    onchange
  }: {
    view: 'image' | 'pyramid'
    layout: 'split' | 'image' | 'pyramid'
    onchange: (layout: 'split' | 'image' | 'pyramid') => void
  } = $props()
  const name = $derived(view === 'image' ? 'image' : 'pyramid')
</script>

{#if layout !== 'split' && layout !== view}
  <button
    class="quiet-button overlay-drag-handle overlay-title"
    data-drag-handle
    aria-label={`Move ${name} overlay`}
    title="Drag to move overlay · arrow keys to move"
  >
    <DotsSix size={18} /><span
      >{view === 'image' ? 'Image' : 'Tile pyramid'}</span
    >
  </button>
  <button
    class="quiet-button inset-expand"
    aria-label={`Make ${name} full view`}
    title={`Make ${name} full view`}
    onclick={() => onchange(view)}><ArrowsOutSimple size={20} /></button
  >
{/if}
