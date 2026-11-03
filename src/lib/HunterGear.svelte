<script lang="ts">
  import type { HunterOutfit } from './iiif-figure'

  let {
    outfit,
    accent,
    invalid
  }: {
    outfit: HunterOutfit
    accent: string
    invalid: boolean
  } = $props()
</script>

<g
  class:invalid
  data-outfit={outfit}
  stroke="white"
  stroke-width="1.5"
  paint-order="stroke fill"
>
  {#if outfit === 'bicorne'}
    <g transform="translate(0 -44) rotate(-5)">
      <path
        d="M-11-4.5Q-7-3.2-4.5-7Q-1-12 3-7.5Q6.2-3.6 11-5Q8.5-.6 2 .6Q-5 2-11-4.5Z"
        fill="#23303a"
        stroke-width="2"
      />
      <path d="M-8.5-3.8Q-.5 1.8 8.7-3.8" stroke="#f1c56c" stroke-width="1.1" />
      <circle cx="4" cy="-3" r="1.6" fill={accent} stroke-width=".7" />
    </g>
  {:else if outfit === 'deerstalker'}
    <g transform="translate(0 -44) rotate(-4)">
      <path
        d="M-10 1L-6-2Q-5-8 .5-8Q5-8 6.5-2L12-.5Q9 1.6 5 .6L-4 .3Q-7 3-10 1Z"
        fill="#9e7351"
      />
      <path
        d="M-3-6.5L1 .2M1.3-7.4L5-1M-4.2-3.7L3.6-5.4"
        stroke="#edd1a3"
        stroke-width=".85"
      />
      <path
        d="M-5.3-2.3L-.8-3Q.2-1-1.7 2.2Q-4.1 3.5-5.3-2.3Z"
        fill="#694630"
        stroke="#d8b38b"
        stroke-width=".8"
      />
    </g>
    <path d="M-2.8-34L5.5-23" stroke="#694630" stroke-width="1.4" />
    <g transform="translate(5.5 -22) rotate(-32)">
      <path d="M0 2.7V7" stroke="#f0cb8a" stroke-width="2.6" />
      <circle
        r="3.1"
        fill="#a9dddf"
        stroke="#694630"
        stroke-width="1.5"
        paint-order="fill stroke"
      />
      <path d="M-1.5-.5L-.4-1.5" stroke="white" stroke-width=".9" />
    </g>
  {:else if outfit === 'alpine'}
    <g transform="translate(0 -44) rotate(-8)">
      <path
        d="M-8-.6L-5-2.8L-2.6-8.1Q-1.8-9.2-.3-7.8L4.2-5.4L6.3-1.8L9-3Q9 1.6 3 1.4L-4 .6Q-8 1.8-8-.6Z"
        fill="#476344"
      />
      <path d="M-4.8-2.7Q.2-1 5-2" stroke="#efb75f" stroke-width="1.35" />
      <path d="M3-2.4Q3.6-10.3 10.4-11.4Q10.1-5.8 3-2.4Z" fill="#ce794b" />
      <path d="M3-2.4L8-8.9" stroke="#70452d" stroke-width=".8" />
    </g>
    <path
      d="M-3.7-36L-.8-34.9L4-36.1L1.5-32.8L-2-33.5L-5-29.5L-5.5-32L-7-31.6L-4.3-35Z"
      fill="#e9a43d"
      stroke-width="1.1"
    />
  {:else if outfit === 'ranger'}
    <g transform="translate(0 -44) rotate(4)">
      <path
        d="M-10.8-.7L-6-1.9L-4.3-7.2Q-3.8-8.5-2.4-7.9L-.2-7L2.2-8Q3.8-8.8 4.3-7.1L6.1-1.8L11-.7Q11.7 1.4 0 1.5Q-11.5 1.4-10.8-.7Z"
        fill="#ccaa75"
      />
      <path d="M-5.2-2.6Q0-1.4 5.4-2.6" stroke="#68482d" stroke-width="1.8" />
    </g>
    <path d="M-3-34L-1.2-28H2L3.6-34" stroke="#4c4234" stroke-width="1.2" />
    <g transform="translate(.5 -27) rotate(7)">
      <path
        d="M-3.9-2H-1L-.6-.7H.6L1-2H3.9L5 3H.7V1H-.7V3H-5Z"
        fill="#354541"
      />
      <path
        d="M-4.3 2.8H-1.6M1.6 2.8H4.3"
        stroke="#9fd5da"
        stroke-width="1.5"
      />
    </g>
  {/if}
</g>

<style>
  .invalid {
    filter: grayscale(1);
  }
</style>
