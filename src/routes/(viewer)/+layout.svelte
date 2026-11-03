<script lang="ts">
  import type { Snippet } from 'svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/state'
  import Pyramid from '$lib/Pyramid.svelte'
  import { hunterOutfits } from '$lib/iiif-figure'

  let { children }: { children: Snippet } = $props()
  const params = $derived(browser ? page.url.searchParams : undefined)
  const hunterOutfit = $derived(
    hunterOutfits.find((outfit) => outfit.id === params?.get('outfit'))?.id
  )
  const figureVariant = $derived(
    params?.get('figureStyle') === 'original'
      ? 'original'
      : params?.get('figureStyle') === 'iiif-open'
        ? 'iiif-open'
        : 'iiif'
  )
  const figurePalette = $derived(
    params?.get('figurePalette') === 'app' ? 'app' : 'iiif'
  )
</script>

<!-- Keep both MapLibre instances alive while only the route's controls change. -->
<Pyramid
  game={page.route.id === '/(viewer)/game'}
  {figureVariant}
  {figurePalette}
  {hunterOutfit}
/>
{@render children()}
