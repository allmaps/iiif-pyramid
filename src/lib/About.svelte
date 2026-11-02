<script lang="ts">
  import { dismissOnBackdrop } from './dismiss-on-backdrop'
  import { Info, X } from 'phosphor-svelte'
  import logo from './images/allmaps-logo.svg'

  let dialog: HTMLDialogElement

  function show() {
    dialog.showModal()
    dialog.scrollTop = 0
  }
</script>

<button
  class="icon-button"
  aria-label="About Allmaps IIIF Pyramid"
  aria-haspopup="dialog"
  title="About this app"
  onclick={show}><Info size={20} /></button
>

<dialog
  use:dismissOnBackdrop
  bind:this={dialog}
  class="about-dialog"
  aria-labelledby="about-title"
  aria-describedby="about-intro"
  onkeydown={(event) => event.stopPropagation()}
>
  <div class="about-heading">
    <div>
      <img src={logo} alt="" width="36" height="36" />
      <h2 id="about-title">About Allmaps IIIF Pyramid</h2>
    </div>
    <button
      class="icon-button"
      aria-label="Close about"
      onclick={() => dialog.close()}><X size={20} /></button
    >
  </div>

  <div class="about-content">
    <p id="about-intro" class="about-intro">
      Explore how a very large image becomes a collection of small tiles, one
      resolution at a time.
    </p>

    <section aria-labelledby="about-pyramid-title">
      <h3 id="about-pyramid-title">How the pyramid works</h3>
      <p>
        The <a
          href="https://iiif.io/api/image/3.0/"
          target="_blank"
          rel="noreferrer">IIIF Image API</a
        > lets a viewer request just the pieces of an image it needs. Zoom out and
        a few coarse tiles cover the image; zoom in and finer tiles reveal more detail.
      </p>
      <p>
        Each layer shows the same image at a different resolution. <strong
          >1:1</strong
        >
        is full resolution; at <strong>1:4</strong>, the image is one quarter as
        wide and high. Coarser layers sit above finer ones. Each layer stops
        loading finer detail at its own resolution, even when you zoom closer.
      </p>
      <p>
        Use the pyramid’s settings button to tilt the layers left or right and
        choose a stacked or adjacent layout. Wide panoramas align along their
        side in the adjacent layout, while the stack adapts its spacing to the
        image’s shape. Both layouts show the same resolutions and tiles.
      </p>
      <p class="about-legend">
        <span aria-hidden="true"></span>Pink outlines show the image viewport
        and active tiles in the pyramid. The grid shows tile boundaries.
      </p>
    </section>

    <section aria-labelledby="about-explore-title">
      <h3 id="about-explore-title">Try it yourself</h3>
      <ul class="about-controls">
        <li>
          <strong>Explore both views.</strong> Pan and zoom either side. The location
          button beside the pyramid’s zoom controls turns following the image position
          on or off. Use Full view to keep the other as a small inset. Drag the inset’s
          title to move it; its full button swaps views while keeping the inset in
          place.
        </li>
        <li>
          <strong>Choose a resolution.</strong> Click a layer label, a minimap layer,
          or a row in the zoom-level table. Enable Show tile details in Pyramid settings,
          then click a tile to see its region, dimensions, and original image link.
        </li>
        <li>
          <strong>Find your place.</strong> Both minimaps show your position. Pyramid
          controls include a figure you can drag onto a layer to move the image there.
          It starts on for very large pyramids.
        </li>
        <li>
          <strong>Share your position.</strong> Export and share → Share current view
          creates a close-up of the figure and its surrounding tiles, plus a link
          to both cameras, the current resolution, and your layout. Copy the link,
          download the preview, or share them together when your browser supports
          it.
        </li>
        <li>
          <strong>Explore another image or save a view.</strong> Open the image chooser
          for examples or paste a IIIF image URL, manifest, or Content State. Manifests
          include a page selector. Export and share → Download pyramid image exports
          the current view or an overview as a PNG.
        </li>
        <li>
          <strong>Play tile hunt.</strong> The gamepad opens five rounds of finding
          a tile’s position and resolution. Place the figure on the matching tile
          and submit your guess. Accuracy and speed earn points. The question-mark
          button reopens the game instructions.
        </li>
        <li>
          <strong>Embed a pyramid.</strong> Export and share → Embed pyramid creates
          iframe code with options for the layout, controls, minimaps, and starting
          position.
        </li>
      </ul>
    </section>

    <section aria-labelledby="about-shortcuts-title">
      <h3 id="about-shortcuts-title">Keyboard shortcuts</h3>
      <ul class="about-controls">
        <li><kbd>[</kbd> Move to the next coarser level.</li>
        <li><kbd>]</kbd> Move to the next finer level.</li>
        <li>
          <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> Select an adjacent tile.
        </li>
        <li><kbd>Shift</kbd> + arrow moves ten tiles.</li>
        <li>
          <kbd>+</kbd> / <kbd>−</kbd> Zoom in / out; <kbd>0</kbd> returns to the overview.
        </li>
        <li>
          <kbd>⌘</kbd> / <kbd>Ctrl</kbd> + arrow jumps to the end of the row or column.
        </li>
      </ul>
      <p>
        These shortcuts work in the explorer and Tile Hunt. Level shortcuts move
        both views even with following off. Close any open dialog or menu first.
      </p>
    </section>

    <section class="about-credits" aria-labelledby="about-credits-title">
      <h3 id="about-credits-title">Credits</h3>
      <p>
        Made by Jules Schoonman and based on his earlier <a
          href="https://observablehq.com/@allmaps/tile-pyramid"
          target="_blank"
          rel="noreferrer">IIIF tile pyramid notebook</a
        >.
      </p>
      <p>
        Image rendering by <a
          href="https://allmaps.org/"
          target="_blank"
          rel="noreferrer">Allmaps</a
        >
        and
        <a href="https://maplibre.org/" target="_blank" rel="noreferrer"
          >MapLibre GL JS</a
        >.
      </p>
      <p>
        Built with <a
          href="https://svelte.dev/"
          target="_blank"
          rel="noreferrer">SvelteKit</a
        >,
        <a href="https://tailwindcss.com/" target="_blank" rel="noreferrer"
          >Tailwind CSS</a
        >, and
        <a href="https://phosphoricons.com/" target="_blank" rel="noreferrer"
          >Phosphor icons</a
        >.
      </p>
      <p>
        The position figure is adapted from the
        <a href="https://iiif.io/" target="_blank" rel="noreferrer">IIIF</a>
        logo: three i’s form the body and legs, and the f forms the arms.
      </p>
      <p>
        Tile Hunt’s IIIF confetti uses shapes from
        <a
          href="https://github.com/tu-delft-heritage/openmapsmeeting/blob/main/src/confetti.md"
          target="_blank"
          rel="noreferrer">Open Maps Meeting</a
        >, animated with
        <a
          href="https://github.com/catdad/canvas-confetti"
          target="_blank"
          rel="noreferrer">canvas-confetti</a
        >.
      </p>
      <p>
        Example images from the Rijksmuseum, Museum Panorama Mesdag, University
        of Amsterdam, TU Delft, and Princeton University Library. Thank you to
        the collections sharing their images through IIIF.
      </p>
    </section>
  </div>
</dialog>
