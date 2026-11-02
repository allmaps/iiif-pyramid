<script lang="ts">
  import { dismissOnBackdrop } from './dismiss-on-backdrop'
  import { onDestroy, tick } from 'svelte'
  import Loading from './Loading.svelte'
  import {
    ShareNetwork,
    LinkSimple,
    DownloadSimple,
    Check,
    X
  } from 'phosphor-svelte'
  import { shareUrl } from './share-view'
  import { contentState } from './iiif-source'
  import type { ShareSnapshot } from './share-view'

  let {
    getSnapshot,
    disabled = false
  }: {
    getSnapshot: () => ShareSnapshot | undefined
    disabled?: boolean
  } = $props()
  let dialog: HTMLDialogElement
  let linkInput = $state<HTMLInputElement>()
  let snapshot = $state.raw<ShareSnapshot>()
  let url = $state('')
  let encodedState = $state('')
  let preview = $state('')
  let file = $state.raw<File>()
  let busy = $state(false)
  let progress = $state('')
  let error = $state('')
  let copyMessage = $state('')
  let copied = $state(false)
  let manualCopy = $state(false)
  let canShare = $state(false)
  let controller: AbortController | undefined

  $effect(() => {
    if (disabled && dialog?.open) dialog.close()
  })

  function clear() {
    controller?.abort()
    controller = undefined
    if (preview) URL.revokeObjectURL(preview)
    preview = ''
    file = undefined
    busy = false
    canShare = false
  }

  export function show() {
    if (disabled) return
    clear()
    snapshot = getSnapshot()
    copied = false
    manualCopy = false
    copyMessage = ''
    error = ''
    encodedState = snapshot
      ? (contentState(snapshot.pyramid.source, snapshot.pyramid.viewport) ?? '')
      : ''
    url = snapshot
      ? shareUrl(
          location.href,
          snapshot.pyramid.source.url,
          snapshot.view,
          encodedState
        )
      : ''
    dialog.showModal()
    if (snapshot) void generate()
    else error = 'Wait for both views to finish loading, then reopen Share.'
  }

  async function generate() {
    if (!snapshot) return
    const current = snapshot
    controller?.abort()
    const request = new AbortController()
    controller = request
    busy = true
    error = ''
    progress = 'Creating preview…'
    try {
      const { createSharePreview } = await import('./share-preview')
      request.signal.throwIfAborted()
      const blob = await createSharePreview(
        current,
        request.signal,
        (message) => {
          if (controller === request) progress = message
        }
      )
      request.signal.throwIfAborted()
      preview = URL.createObjectURL(blob)
      file = new File([blob], 'allmaps-pyramid-shared-view.png', {
        type: 'image/png'
      })
      canShare =
        typeof navigator.share === 'function' &&
        navigator.canShare?.({
          files: [file],
          title: current.pyramid.source.title,
          url
        }) === true
      progress = 'Preview ready'
    } catch (cause) {
      if (!request.signal.aborted) {
        error =
          cause instanceof Error
            ? cause.message
            : 'The preview could not be created.'
        progress = ''
      }
    } finally {
      if (controller === request) {
        busy = false
        controller = undefined
      }
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      copied = true
      copyMessage = 'Link copied'
    } catch {
      manualCopy = true
      await tick()
      linkInput?.focus()
      linkInput?.select()
      copyMessage = 'Copy the selected link with your keyboard or browser menu.'
    }
  }

  function download() {
    if (!file || !preview) return
    const link = document.createElement('a')
    link.href = preview
    link.download = file.name
    link.click()
  }

  async function share() {
    if (!file || !snapshot) return
    try {
      // Preview is prepared beforehand so sharing starts within the click gesture.
      await navigator.share({
        title: snapshot.pyramid.source.title,
        text: 'Explore this view in Allmaps IIIF Pyramid',
        url,
        files: [file]
      })
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      copyMessage =
        'Sharing is unavailable here. Copy the link and download the preview instead.'
    }
  }

  onDestroy(clear)
</script>

<dialog
  use:dismissOnBackdrop
  bind:this={dialog}
  class="share-dialog"
  aria-labelledby="share-title"
  onclose={clear}
  onkeydown={(event) => event.stopPropagation()}
>
  <div class="dialog-title">
    <h2 id="share-title">Share this view</h2>
    <button
      class="icon-button"
      aria-label="Close share"
      onclick={() => dialog.close()}><X size={20} /></button
    >
  </div>
  <div class="share-preview" aria-busy={busy}>
    {#if preview}
      <img
        src={preview}
        alt={`Close-up of the position figure and tiles in ${snapshot?.pyramid.source.title}, at resolution 1:${snapshot?.view.level}`}
      />
    {:else}
      <div class="share-placeholder">
        {#if busy}<Loading />{/if}
        <span class="sr-only"
          >{busy ? 'Creating your preview…' : 'Preview unavailable'}</span
        >
      </div>
    {/if}
  </div>
  <div class="sr-only" role="status" aria-live="polite">{progress}</div>
  {#if error}<p class="share-error" role="alert">{error}</p>
    {#if snapshot && !busy}<button class="primary-button" onclick={generate}
        >Retry preview</button
      >{/if}
  {/if}
  {#if manualCopy}
    <div class="share-link-row">
      <input
        bind:this={linkInput}
        id="share-link"
        aria-label="Link to this view"
        readonly
        value={url}
        onclick={() => linkInput?.select()}
      />
    </div>
  {/if}
  <p class="sr-only" role="status">{copyMessage}</p>
  <div class="share-actions">
    <button class="primary-button" disabled={!url} onclick={copy}
      >{#if copied}<Check size={17} />{:else}<LinkSimple
          size={17}
        />{/if}{copied ? 'Copied' : 'Copy link'}</button
    >
    {#if encodedState}<button
        class="primary-button"
        onclick={async () => {
          try {
            await navigator.clipboard.writeText(encodedState)
            copyMessage = 'Encoded IIIF Content State copied'
          } catch {
            copyMessage =
              'Clipboard unavailable. The shared link contains the Content State in iiif-content.'
          }
        }}>Copy IIIF Content State</button
      >{/if}
    <button class="primary-button" disabled={!file} onclick={download}
      ><DownloadSimple size={17} />{busy
        ? 'Preparing preview…'
        : 'Download preview'}</button
    >
    {#if canShare}<button class="primary-button" onclick={share}
        ><ShareNetwork size={17} />Share image & link</button
      >{/if}
  </div>
</dialog>
