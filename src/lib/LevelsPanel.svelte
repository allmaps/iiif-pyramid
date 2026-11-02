<script lang="ts">
  import { dismissOnBackdrop } from './dismiss-on-backdrop'
  import { tick } from 'svelte'
  import { Table, X } from 'phosphor-svelte'
  import type { ImageSource, Level } from './iiif'
  let {
    source,
    activeFactor,
    activeTileCount,
    onlevel
  }: {
    source: ImageSource | undefined
    activeFactor: number
    activeTileCount: number
    onlevel: (level: Level) => void
  } = $props()
  let dialog: HTMLDialogElement
  let tableScroll: HTMLDivElement
  const levels = $derived(source?.levels ?? [])
  const totalTiles = $derived(
    levels.reduce((total, level) => total + level.tileCount, 0)
  )
  const number = (n: number) => n.toLocaleString('en-US')
  async function show() {
    dialog.showModal()
    await tick()
    tableScroll
      .querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
</script>

<button
  class="quiet-button"
  aria-label="Zoom level table"
  aria-haspopup="dialog"
  title="Zoom level table"
  disabled={!source}
  onclick={show}><Table size={20} /></button
>
<dialog
  use:dismissOnBackdrop
  bind:this={dialog}
  class="levels-dialog"
  aria-labelledby="levels-title"
>
  <div class="dialog-title">
    <h2 id="levels-title">Zoom levels</h2>
    <button
      class="icon-button"
      aria-label="Close zoom level table"
      onclick={() => dialog.close()}><X size={20} /></button
    >
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable data table needs keyboard access.) -->
  <div
    class="level-table-scroll"
    bind:this={tableScroll}
    role="region"
    aria-label="Zoom level data"
    tabindex="0"
  >
    <table class="level-table">
      <caption class="sr-only"
        >IIIF zoom levels for {source?.title ?? 'this image'}</caption
      >
      <thead>
        <tr>
          <th scope="col">Level <span>(z)</span></th>
          <th scope="col">Resolution</th>
          <th scope="col" class="numeric">Image size <span>(px)</span></th>
          <th scope="col" class="numeric">Tile size <span>(px)</span></th>
          <th scope="col" class="numeric">Columns</th>
          <th scope="col" class="numeric">Rows</th>
          <th scope="col" class="numeric">Tiles</th>
          <th scope="col" class="numeric">Active tiles</th>
        </tr>
      </thead>
      <tbody>
        {#each levels as level (level.scaleFactor)}
          {@const current = activeFactor === level.scaleFactor}
          <tr class:current>
            <th scope="row">{level.index}</th>
            <td>
              <button
                class="level-table-resolution"
                aria-current={current ? 'true' : undefined}
                aria-label={`Go to level ${level.index}, resolution 1:${level.scaleFactor}`}
                title={`Show resolution 1:${level.scaleFactor} in both views`}
                onclick={() => {
                  dialog.close()
                  onlevel(level)
                }}>1:{level.scaleFactor}</button
              >
              {#if current}<span class="level-current-label">Current</span>{/if}
            </td>
            <td class="numeric"
              >{number(level.width)} × {number(level.height)}</td
            >
            <td
              class="numeric"
              title="Maximum tile dimensions at this level; edge tiles may be smaller"
              >{number(level.tileWidth)} × {number(level.tileHeight)}</td
            >
            <td class="numeric">{number(level.columns)}</td>
            <td class="numeric">{number(level.rows)}</td>
            <td class="numeric">{number(level.tileCount)}</td>
            <td class="numeric">{current ? number(activeTileCount) : '—'}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row"
            >{number(levels.length)}
            {levels.length === 1 ? 'level' : 'levels'}</th
          >
          <td colspan="5">Total</td>
          <td class="numeric">{number(totalTiles)}</td>
          <td class="numeric">{number(activeTileCount)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</dialog>
