<script lang="ts">
  import { CaretDown, CaretUp } from 'phosphor-svelte'
  import type { Snippet } from 'svelte'

  let {
    kind,
    visible,
    game = false,
    children
  }: {
    kind: 'image' | 'pyramid'
    visible: boolean
    game?: boolean
    children: Snippet
  } = $props()

  let explorerCollapsed = $state(false)
  let gameCollapsed = $state(true)
  const collapsed = $derived(game ? gameCollapsed : explorerCollapsed)
  $effect(() => {
    if (!game) gameCollapsed = true
  })
</script>

<div
  class="minimap"
  data-overlay-obstacle
  class:pyramid-minimap={kind === 'pyramid'}
  class:collapsed
  hidden={!visible}
  role="group"
  aria-label={`${kind === 'image' ? 'Image' : 'Pyramid'} minimap`}
>
  <div class="minimap-header">
    <button
      class="minimap-toggle"
      aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${kind} minimap`}
      title={`${collapsed ? 'Expand' : 'Collapse'} ${kind} minimap`}
      aria-expanded={!collapsed}
      aria-controls={`${kind}-minimap-content`}
      onclick={() => {
        if (game) gameCollapsed = !gameCollapsed
        else explorerCollapsed = !explorerCollapsed
      }}
    >
      <span>Overview</span>
      {#if collapsed}<CaretUp size={12} />{:else}<CaretDown size={12} />{/if}
    </button>
  </div>
  <div
    id={`${kind}-minimap-content`}
    class="minimap-content"
    hidden={collapsed}
  >
    {@render children()}
  </div>
</div>
