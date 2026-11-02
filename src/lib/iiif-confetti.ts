import confetti from 'canvas-confetti'
import shapes from './images/iiif-confetti-shapes.json'
import type { Point } from './geometry'

/** IIIF paths and matrices from Open Maps Meeting's confetti demo. */
export async function celebrateIIIF(
  parent: HTMLElement,
  point: Point,
  signal: AbortSignal
) {
  if (signal.aborted || matchMedia('(prefers-reduced-motion: reduce)').matches)
    return
  const canvas = document.createElement('canvas')
  canvas.className = 'iiif-confetti'
  canvas.setAttribute('aria-hidden', 'true')
  parent.append(canvas)
  const burst = confetti.create(canvas, {
    resize: true,
    disableForReducedMotion: true
  })
  const cancel = () => burst.reset()
  signal.addEventListener('abort', cancel, { once: true })
  try {
    const box = canvas.getBoundingClientRect()
    await burst({
      origin: { x: point[0] / box.width, y: point[1] / box.height },
      particleCount: 90,
      spread: 110,
      startVelocity: 26,
      gravity: 0.75,
      scalar: 1.5,
      ticks: 220,
      colors: ['#2873ab', '#ed1d33'],
      // The library accepts numeric matrix arrays; @types calls them DOMMatrix.
      shapes: shapes as unknown as confetti.Shape[]
    })
  } finally {
    signal.removeEventListener('abort', cancel)
    burst.reset()
    canvas.remove()
  }
}
