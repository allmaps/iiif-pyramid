<script lang="ts">
  import type { Snippet } from 'svelte'
  import logo from '$lib/images/allmaps-logo.svg'
  import '../app.css'
  import 'maplibre-gl/dist/maplibre-gl.css'
  let { children }: { children: Snippet } = $props()
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={logo} />
</svelte:head>

{@render children()}
