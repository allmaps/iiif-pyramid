<script lang="ts">
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import PageMetadata from '$lib/PageMetadata.svelte'
  import Pyramid from '$lib/Pyramid.svelte'
  import { readEmbedOptions } from '$lib/embed-options'
  let mounted = $state(false)
  onMount(() => {
    mounted = true
  })
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

<PageMetadata
  title="Allmaps IIIF Pyramid"
  description="An embedded, interactive view of an IIIF image and its tile pyramid."
  path="embed/"
  noindex
/>
{#if mounted}<Pyramid embed={options} {figureVariant} {figurePalette} />{/if}
