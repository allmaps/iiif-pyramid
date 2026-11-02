<script lang="ts">
  import { untrack } from 'svelte'
  import { Tween, prefersReducedMotion } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { figurePalettes, iiifFigureParts } from './iiif-figure'
  import type { FigureOptions } from './iiif-figure'
  import {
    figureBody,
    figureLimbs,
    figureDraggingLimbs
  } from './position-marker'

  let {
    dragging = false,
    invalid = false,
    tilt = 0,
    shadow = true,
    variant = 'iiif',
    palette = 'iiif'
  }: FigureOptions & {
    dragging?: boolean
    invalid?: boolean
    tilt?: number
    shadow?: boolean
  } = $props()
  const extension = new Tween(
    untrack(() => (dragging ? 1 : 0)),
    { easing: cubicOut }
  )
  $effect(() => {
    void extension.set(dragging ? 1 : 0, {
      duration: prefersReducedMotion.current ? 0 : dragging ? 220 : 300
    })
  })
  const colors = $derived(figurePalettes[palette])
  const color = $derived(invalid ? '#8b9390' : colors.primary)
  const limbsColor = $derived(
    invalid ? '#8b9390' : palette === 'app' ? color : colors.secondary
  )
  const parts = $derived(
    variant === 'original'
      ? []
      : iiifFigureParts(variant, palette, extension.current, invalid)
  )
</script>

<svg
  width="44"
  height="60"
  viewBox="-22 -54 44 60"
  fill="none"
  aria-hidden="true"
  class:dragging
  data-variant={variant}
  data-palette={palette}
>
  {#if shadow}<g
      class="figure-shadow"
      style:opacity={1 - extension.current * 0.45}
      style:transform={`scale(${1 - extension.current * 0.25})`}
    >
      <ellipse
        rx="11"
        ry="4"
        fill={`${colors.primary}40`}
        stroke="white"
        stroke-width="4"
      />
      <ellipse rx="11" ry="4" stroke={colors.primary} stroke-width="1.5" />
    </g>{/if}
  <g
    class="figure-person"
    style:--figure-tilt={`${tilt}deg`}
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {#if variant === 'original'}
      <path
        d={dragging ? figureDraggingLimbs : figureLimbs}
        stroke="white"
        stroke-width="8"
      />
      <path
        d={dragging ? figureDraggingLimbs : figureLimbs}
        stroke={limbsColor}
        stroke-width="5"
      />
      <path
        d={figureBody}
        fill={color}
        stroke="white"
        stroke-width="3"
        paint-order="stroke fill"
      />
      <circle
        cy="-41"
        r="5.5"
        fill={color}
        stroke="white"
        stroke-width="3"
        paint-order="stroke fill"
      />
    {:else}
      {#each parts as part (part.id)}
        <path
          d={part.path}
          transform={`matrix(${part.matrix.join(' ')})`}
          fill={part.color}
          stroke="white"
          stroke-width={part.outline}
          paint-order="stroke fill"
          data-part={part.id}
        />
      {/each}
    {/if}
  </g>
</svg>

<style>
  .figure-person {
    transform-origin: 0 -28px;
    transition:
      transform 180ms ease,
      opacity 160ms ease;
  }
  .dragging .figure-person {
    transform: translateY(-5px) rotate(var(--figure-tilt));
  }
  @media (prefers-reduced-motion: reduce) {
    .figure-person {
      transition: none;
    }
  }
</style>
