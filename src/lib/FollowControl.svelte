<script lang="ts">
  import { Crosshair, CrosshairSimple } from 'phosphor-svelte'
  let {
    enabled,
    onclick
  }: {
    enabled: boolean
    onclick: () => void
  } = $props()
  const action = $derived(
    enabled
      ? 'Disable following image position'
      : 'Enable following image position'
  )
</script>

<button
  class="follow-control"
  class:enabled
  aria-label="Follow image position"
  aria-pressed={enabled}
  title={action}
  {onclick}
>
  {#if !enabled}
    <CrosshairSimple size={20} />
  {:else}
    <Crosshair size={20} weight="fill" />
  {/if}
</button>
