<script lang="ts">
  let {
    title,
    description,
    path = '',
    game = false,
    noindex = false
  }: {
    title: string
    description: string
    path?: string
    game?: boolean
    noindex?: boolean
  } = $props()

  const site =
    (
      import.meta.env.VITE_SITE_URL || 'https://pages.allmaps.org/iiif-pyramid'
    ).replace(/\/+$/, '') + '/'
  const canonical = $derived(new URL(path, site).href)
  const image = $derived(
    new URL(
      game ? 'social/tile-hunt.jpg?v=alpine-2' : 'social/pyramid.jpg',
      site
    ).href
  )
  const alt = $derived(
    game
      ? 'Allmaps IIIF Tile Hunt. A hunter in a feathered Alpine hat and scarf stands on a pink-outlined tile in the isometric pyramid of The Night Watch.'
      : 'Allmaps IIIF Pyramid. Stacked levels of The Night Watch show the tile grid, with the captain’s tile outlined in pink.'
  )
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  {#if noindex}<meta name="robots" content="noindex" />{/if}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Allmaps" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={image} />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={alt} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
  <meta name="twitter:image:alt" content={alt} />
</svelte:head>
