<script lang="ts">
  import PageMetadata from '$lib/PageMetadata.svelte'
  import { base } from '$app/paths'
  const description =
    'Explore how IIIF images load at different resolutions. Zoom into an image and see its tiles in an interactive isometric pyramid.'
</script>

<PageMetadata title="Allmaps IIIF Pyramid" {description} />
<noscript
  ><h1>Allmaps IIIF Pyramid</h1>
  <p>{description} Enable JavaScript to explore.</p>
  <a href={`${base}/game/`}>Play Allmaps IIIF Tile Hunt</a></noscript
>
