<script lang="ts">
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import Pyramid from '$lib/Pyramid.svelte'

  let { children }: { children: Snippet } = $props()
  const figureVariant = $derived(
    page.url.searchParams.get('figureStyle') === 'original'
      ? 'original'
      : page.url.searchParams.get('figureStyle') === 'iiif-open'
        ? 'iiif-open'
        : 'iiif'
  )
  const figurePalette = $derived(
    page.url.searchParams.get('figurePalette') === 'app' ? 'app' : 'iiif'
  )
</script>

<!-- Keep both MapLibre instances alive while only the route's controls change. -->
<Pyramid
  game={page.route.id === '/(viewer)/game'}
  {figureVariant}
  {figurePalette}
/>
{@render children()}
