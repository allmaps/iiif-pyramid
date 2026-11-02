<script lang="ts">
  import { overviewFrame, overviewImages } from './image-overview'
  import { viewportCenter } from './position-marker'
  import type { ImageSource } from './iiif'
  import type { Bounds, Point } from './geometry'

  let {
    source,
    viewport,
    oncenter
  }: {
    source: ImageSource
    viewport: Bounds | undefined
    oncenter: (point: Point) => void
  } = $props()

  const images = $derived(overviewImages(source))
  const frame = $derived(overviewFrame(source.image.width, source.image.height))
  const view: Bounds = $derived(
    viewport ?? [0, 0, source.image.width, source.image.height]
  )
  const center = $derived(viewportCenter(view)!)

  function recenter(point: Point) {
    oncenter([
      Math.max(0, Math.min(source.image.width, point[0])),
      Math.max(0, Math.min(source.image.height, point[1]))
    ])
  }

  function click(
    event: MouseEvent & { currentTarget: EventTarget & SVGSVGElement }
  ) {
    const matrix = event.currentTarget.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse()
    )
    recenter([
      (point.x - frame.x) / frame.scale,
      (point.y - frame.y) / frame.scale
    ])
  }

  function keydown(event: KeyboardEvent) {
    const dx = Math.max(1, view[2] - view[0]) / 4
    const dy = Math.max(1, view[3] - view[1]) / 4
    const steps: Record<string, Point> = {
      ArrowLeft: [-dx, 0],
      ArrowRight: [dx, 0],
      ArrowUp: [0, -dy],
      ArrowDown: [0, dy]
    }
    if (steps[event.key]) {
      event.preventDefault()
      const [x, y] = steps[event.key]
      recenter([center[0] + x, center[1] + y])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      recenter([source.image.width / 2, source.image.height / 2])
    }
  }
</script>

<svg
  class="image-minimap-canvas"
  viewBox="0 0 180 132"
  role="button"
  tabindex="0"
  aria-label="Navigate image overview"
  aria-describedby="image-minimap-help"
  onclick={click}
  onkeydown={keydown}
>
  <title>Click to recenter the image</title>
  <rect
    x={frame.x}
    y={frame.y}
    width={frame.width}
    height={frame.height}
    fill="#d0e5d8"
  />
  {#each images as image (image.url)}
    <image
      href={image.url}
      x={frame.x + image.x * frame.scale}
      y={frame.y + image.y * frame.scale}
      width={image.width * frame.scale}
      height={image.height * frame.scale}
      preserveAspectRatio="none"
      pointer-events="none"
    />
  {/each}
  <rect
    x={frame.x}
    y={frame.y}
    width={frame.width}
    height={frame.height}
    fill="none"
    stroke="#668673"
    stroke-width="0.7"
  />
  <rect
    class="image-minimap-viewport"
    x={frame.x + view[0] * frame.scale}
    y={frame.y + view[1] * frame.scale}
    width={(view[2] - view[0]) * frame.scale}
    height={(view[3] - view[1]) * frame.scale}
    fill="#ff56ba22"
    stroke="white"
    stroke-width="4"
    paint-order="stroke fill"
    vector-effect="non-scaling-stroke"
    pointer-events="none"
  />
  <rect
    x={frame.x + view[0] * frame.scale}
    y={frame.y + view[1] * frame.scale}
    width={(view[2] - view[0]) * frame.scale}
    height={(view[3] - view[1]) * frame.scale}
    fill="none"
    stroke="#d12c85"
    stroke-width="1.5"
    vector-effect="non-scaling-stroke"
    pointer-events="none"
  />
</svg>
<span id="image-minimap-help" class="sr-only"
  >Click to recenter. Arrow keys pan the image; Enter centers it.</span
>
