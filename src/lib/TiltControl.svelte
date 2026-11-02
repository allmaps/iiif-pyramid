<script lang="ts">
  import { tick } from 'svelte'
  import { SlidersHorizontal, X } from 'phosphor-svelte'
  import type { TiltDirection, PyramidLayout } from './geometry'

  let {
    value,
    onchange,
    layout,
    onlayout,
    disabled = false,
    grid,
    fillTilesOnHover = false,
    showTileDetails = false,
    ongrid,
    onhoverfill,
    ontiledetails
  }: {
    value: TiltDirection
    onchange: (direction: TiltDirection) => void
    layout: PyramidLayout
    onlayout: (layout: PyramidLayout) => void
    disabled?: boolean
    grid?: boolean
    fillTilesOnHover?: boolean
    showTileDetails?: boolean
    ongrid?: (value: boolean) => void
    onhoverfill?: (value: boolean) => void
    ontiledetails?: (value: boolean) => void
  } = $props()
  let trigger: HTMLButtonElement
  let menu: HTMLDivElement
  let open = $state(false)
  const directions: TiltDirection[] = ['left', 'right']
  const layouts: PyramidLayout[] = ['stacked', 'adjacent']

  function position() {
    const box = trigger.getBoundingClientRect()
    menu.style.left = `${Math.max(12, Math.min(innerWidth - menu.offsetWidth - 12, box.right - menu.offsetWidth))}px`
    menu.style.top = `${Math.max(12, Math.min(innerHeight - menu.offsetHeight - 12, box.bottom + 8))}px`
  }

  async function show() {
    if (open) {
      menu.hidePopover()
      return
    }
    menu.showPopover()
    await tick()
    position()
    menu.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
  }
</script>

<svelte:window
  onresize={() => {
    if (open) position()
  }}
/>

<button
  bind:this={trigger}
  class="tilt-trigger icon-button"
  aria-label="Pyramid settings"
  aria-haspopup="dialog"
  aria-expanded={open}
  title={`Pyramid settings · tilt ${value}`}
  {disabled}
  onclick={show}><SlidersHorizontal size={18} /></button
>

<div
  bind:this={menu}
  class="tilt-menu"
  popover="auto"
  role="dialog"
  tabindex="-1"
  aria-label="Pyramid settings"
  ontoggle={(event) => (open = event.newState === 'open')}
  onkeydown={(event) => {
    if (event.key === 'Escape') event.stopPropagation()
  }}
>
  <div class="export-title">
    <h3>Pyramid settings</h3>
    <button
      class="icon-button"
      aria-label="Close pyramid settings"
      onclick={() => menu.hidePopover()}><X size={17} /></button
    >
  </div>
  {#if ongrid}<label class="appearance-check"
      ><input
        type="checkbox"
        checked={grid}
        onchange={(event) => ongrid?.(event.currentTarget.checked)}
      />Tile grid</label
    >{/if}
  {#if onhoverfill}<label class="appearance-check"
      ><input
        type="checkbox"
        checked={fillTilesOnHover}
        onchange={(event) => onhoverfill?.(event.currentTarget.checked)}
      />Fill tiles on hover</label
    >{/if}
  {#if ontiledetails}<label class="appearance-check"
      ><input
        type="checkbox"
        checked={showTileDetails}
        onchange={(event) => ontiledetails?.(event.currentTarget.checked)}
      />Show tile details</label
    >{/if}
  <div class="tilt-options" role="group" aria-label="Pyramid layout">
    {#each layouts as option}
      <button
        aria-label={`${option === 'stacked' ? 'Stacked' : 'Adjacent'} layers`}
        aria-pressed={layout === option}
        onclick={() => onlayout(option)}
      >
        <svg viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">
          {#if option === 'stacked'}
            <path
              d="m6 27 26-15 26 15-26 15Z M15 18l17-10 17 10-17 10Z M23 9l9-5 9 5-9 5Z"
            />
          {:else}
            <path
              d="m27 23 17-10 17 10-17 10Z M9 13l11-6 11 6-11 6Z M2 5l5-3 5 3-5 3Z"
            />
          {/if}
        </svg>
        <span>{option === 'stacked' ? 'Stacked' : 'Adjacent'}</span>
      </button>
    {/each}
  </div>
  <div class="tilt-options" role="group" aria-label="Tilt direction">
    {#each directions as direction}
      <button
        aria-label={`Tilt ${direction}`}
        aria-pressed={value === direction}
        onclick={() => onchange(direction)}
      >
        <svg viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">
          <path d="m6 22 26-15 26 15-26 15Z" />
          {#if direction === 'left'}
            <path
              class="tilt-preview-line"
              d="m14 22 18-10 18 10M23 27l18-10"
            />
          {:else}
            <path
              class="tilt-preview-line"
              d="m14 22 18 10 18-10M23 17l18 10"
            />
          {/if}
        </svg>
        <span>Tilt {direction}</span>
      </button>
    {/each}
  </div>
</div>
