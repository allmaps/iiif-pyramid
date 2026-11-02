<script lang="ts">
  import { page } from '$app/state'
  import Pyramid from '$lib/Pyramid.svelte'
  import { readEmbedOptions } from '$lib/embed-options'
  const options = $derived(readEmbedOptions(page.url.searchParams))
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

<svelte:head
  ><title>Allmaps IIIF Pyramid</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<Pyramid embed={options} {figureVariant} {figurePalette} />
