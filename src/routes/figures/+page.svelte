<script lang="ts">
  import { base } from '$app/paths'
  import PositionFigure from '$lib/PositionFigure.svelte'
  import PageMetadata from '$lib/PageMetadata.svelte'
  import iiifLogo from '$lib/images/iiif-logo.svg'
  import type { FigurePalette, FigureVariant } from '$lib/iiif-figure'

  const alternatives: {
    id: string
    title: string
    note: string
    variant: FigureVariant
    palette: FigurePalette
  }[] = [
    {
      id: '01',
      title: 'IIIF · wave',
      note: 'Original logo colors. One arm raised.',
      variant: 'iiif',
      palette: 'iiif'
    },
    {
      id: '02',
      title: 'Allmaps · wave',
      note: 'Pink body, forest-green legs.',
      variant: 'iiif',
      palette: 'app'
    },
    {
      id: '03',
      title: 'IIIF · open',
      note: 'Wider stance and more open arms.',
      variant: 'iiif-open',
      palette: 'iiif'
    },
    {
      id: '04',
      title: 'Original figure',
      note: 'The previous marker, kept as an option.',
      variant: 'original',
      palette: 'app'
    }
  ]
  let lifted = $state<string[]>([])
  const appUrl = (variant: FigureVariant, palette: FigurePalette) =>
    `${base}/?url=https%3A%2F%2Fiiif.micr.io%2FERwIn&figureStyle=${variant}&figurePalette=${palette}`
</script>

<PageMetadata
  title="Position figures — Allmaps IIIF Pyramid"
  description="Explore the position markers in Allmaps IIIF Pyramid, including animated figures made from the letters of the IIIF logo."
  path="figures/"
/>

<main class="figure-studies">
  <header>
    <div>
      <p class="eyebrow">Allmaps IIIF Pyramid / figure studies</p>
      <h1>Three i’s and a split f.</h1>
      <p>
        A body, two legs with dotted feet, and two arms. Lift to spread the
        limbs like a jumping jack.
      </p>
    </div>
    <div class="source-mark">
      <img src={iiifLogo} alt="Original IIIF logo" /><span
        >From the IIIF logo</span
      >
    </div>
  </header>

  <div class="alternatives">
    {#each alternatives as option}
      <section class="alternative" aria-label={option.title}>
        <div class="card-heading">
          <span class="option-number">{option.id}</span>
          <div>
            <h2>{option.title}</h2>
            <p>{option.note}</p>
          </div>
          {#if option.id === '01'}<span class="default-badge">Default</span
            >{/if}
        </div>
        <div class="poses">
          <div class="pose">
            <div class="large-figure">
              <PositionFigure
                variant={option.variant}
                palette={option.palette}
                dragging={lifted.includes(option.id)}
              />
            </div>
            <span>{lifted.includes(option.id) ? 'Lifted' : 'Resting'}</span>
          </div>
          <span class="pose-arrow" aria-hidden="true">↗</span>
          <div class="pose">
            <div class="large-figure">
              <PositionFigure
                variant={option.variant}
                palette={option.palette}
                dragging
              />
            </div>
            <span>Dragging</span>
          </div>
          <div class="actual-size">
            <PositionFigure
              variant={option.variant}
              palette={option.palette}
            /><span>Actual size</span>
          </div>
        </div>
        <footer>
          <button
            aria-label={`Animate ${option.title}`}
            aria-pressed={lifted.includes(option.id)}
            onclick={() =>
              (lifted = lifted.includes(option.id)
                ? lifted.filter((id) => id !== option.id)
                : [...lifted, option.id])}
            >{lifted.includes(option.id) ? 'Release' : 'Try the lift'}
            <span aria-hidden="true">↕</span></button
          >
          <a href={appUrl(option.variant, option.palette)}
            >Try in pyramid <span aria-hidden="true">↗</span></a
          >
        </footer>
      </section>
    {/each}
  </div>
  <p class="study-footer">
    Same vector shapes in the map, exports, and sharing previews. Motion
    respects reduced-motion preferences.
  </p>
</main>

<style>
  .figure-studies {
    height: 100dvh;
    overflow: auto;
    padding: 24px 36px 16px;
    background: #f5faf6;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    max-width: 1200px;
    margin: 0 auto 18px;
  }
  .eyebrow {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 1.4px;
    color: #69816f;
    margin: 0 0 9px;
  }
  h1 {
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.9px;
    margin: 0 0 8px;
  }
  header p:not(.eyebrow) {
    margin: 0;
    font-size: 13px;
    color: #627567;
  }
  .source-mark {
    display: flex;
    align-items: center;
    gap: 14px;
    color: #627567;
    font-size: 11px;
  }
  .source-mark img {
    width: 51px;
    height: 46px;
  }
  .alternatives {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    max-width: 1200px;
    margin: auto;
  }
  .alternative {
    border: 1px solid #b8cabb;
    border-radius: 10px;
    background: #fff;
    overflow: hidden;
  }
  .card-heading {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 14px 20px 10px;
  }
  .option-number {
    font-size: 11px;
    color: #7c9383;
    align-self: flex-start;
    padding-top: 4px;
  }
  h2 {
    font-size: 16px;
    font-weight: 500;
    margin: 0 0 4px;
    letter-spacing: -0.3px;
  }
  .card-heading p {
    font-size: 11px;
    color: #6a7d6e;
    margin: 0;
  }
  .default-badge {
    margin-left: auto;
    font-size: 10px;
    border: 1px solid #c3d6c8;
    padding: 4px 7px;
    border-radius: 4px;
    background: #edf4ed;
    color: #42654b;
  }
  .poses {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 27px;
    height: 148px;
    background: linear-gradient(155deg, #f7faf7, #e9f1eb);
  }
  .pose {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .large-figure {
    width: 88px;
    height: 120px;
  }
  .large-figure :global(svg) {
    width: 88px;
    height: 120px;
    overflow: visible;
  }
  .pose span,
  .actual-size span {
    font-size: 10px;
    color: #718377;
  }
  .pose-arrow {
    color: #a6b9ac;
    font-size: 24px;
    margin-bottom: 20px;
  }
  .actual-size {
    display: flex;
    flex-direction: column;
    align-items: center;
    align-self: flex-end;
    margin: 0 0 18px 17px;
    gap: 3px;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 20px;
    font-size: 11px;
  }
  footer button {
    padding: 0;
    border: 0;
    background: none;
    color: #34543f;
  }
  footer a {
    color: #34543f;
    text-decoration: none;
  }
  footer a:hover {
    text-decoration: underline;
  }
  footer span {
    margin-left: 5px;
  }
  .study-footer {
    max-width: 1200px;
    margin: 16px auto 0;
    font-size: 11px;
    color: #718377;
  }
  @media (max-width: 760px) {
    .figure-studies {
      padding: 24px 16px;
    }
    .alternatives {
      grid-template-columns: 1fr;
    }
    .source-mark {
      display: none;
    }
    .poses {
      gap: 20px;
    }
  }
</style>
