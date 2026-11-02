<script lang="ts">
  import {
    DownloadSimple,
    ShareNetwork,
    Code,
    ImageSquare
  } from 'phosphor-svelte'
  import FanMenu from './FanMenu.svelte'
  import ShareView from './ShareView.svelte'
  import EmbedMenu from './EmbedMenu.svelte'
  import ExportMenu from './ExportMenu.svelte'
  import type { ShareSnapshot } from './share-view'
  import type { PyramidSnapshot } from './export-view'

  let {
    getSnapshot,
    getPyramidSnapshot,
    disabled = false
  }: {
    getSnapshot: () => ShareSnapshot | undefined
    getPyramidSnapshot: () => PyramidSnapshot | undefined
    disabled?: boolean
  } = $props()
  let share = $state<ShareView>()
  let embed = $state<EmbedMenu>()
  let download = $state<ExportMenu>()
</script>

<FanMenu
  label="Export and share"
  icon={DownloadSimple}
  direction="down"
  {disabled}
  options={[
    { value: 'share', label: 'Share current view', icon: ShareNetwork },
    { value: 'download', label: 'Download pyramid image', icon: ImageSquare },
    { value: 'embed', label: 'Embed pyramid', icon: Code }
  ]}
  onselect={(value) => {
    if (value === 'share') share?.show()
    else if (value === 'embed') embed?.show()
    else download?.show()
  }}
/>
<ShareView bind:this={share} {getSnapshot} {disabled} />
<EmbedMenu bind:this={embed} {getSnapshot} {disabled} />
<ExportMenu bind:this={download} getSnapshot={getPyramidSnapshot} {disabled} />
