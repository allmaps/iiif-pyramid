<script lang="ts">
  import PageMetadata from '$lib/PageMetadata.svelte'
  import { base } from '$app/paths'
  const description =
    'Find the pictured tile in an IIIF image pyramid. Choose its location and resolution in five rounds scored on accuracy and speed.'
</script>

<PageMetadata title="Allmaps IIIF Tile Hunt" {description} path="game/" game />
<noscript
  ><h1>Allmaps IIIF Tile Hunt</h1>
  <p>{description} Enable JavaScript to play.</p>
  <a href={`${base}/`}>Explore Allmaps IIIF Pyramid</a></noscript
>
