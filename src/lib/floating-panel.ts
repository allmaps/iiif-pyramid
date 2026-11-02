import type { Action } from 'svelte/action'
import { overlayPosition } from './overlay-position'

export type OverlayPlacement = { position?: [number, number] }
type FloatingPanelOptions =
  boolean | { enabled: boolean; placement: OverlayPlacement }

/** Move an overlay by its handle, leaving map gestures inside it untouched. */
export const floatingPanel: Action<HTMLElement, FloatingPanelOptions> = (
  node,
  options
) => {
  let enabled = typeof options === 'boolean' ? options : options.enabled
  let placement: OverlayPlacement =
    typeof options === 'boolean' ? {} : options.placement
  let disposed = false
  let resizeFrame = 0
  const app = node.closest('.explorer-app')
  let drag:
    | {
        id: number
        x: number
        y: number
        left: number
        top: number
        previous: OverlayPlacement['position']
      }
    | undefined

  function limits() {
    const parent = node.offsetParent as HTMLElement | null
    return {
      x: Math.max(
        12,
        (parent?.clientWidth ?? innerWidth) - node.offsetWidth - 12
      ),
      y: Math.max(
        12,
        (parent?.clientHeight ?? innerHeight) - node.offsetHeight - 12
      )
    }
  }

  function place(left: number, top: number) {
    const max = limits()
    const parent = node.offsetParent as HTMLElement | null
    const frame = parent?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const obstacles = [
      ...(app?.querySelectorAll<HTMLElement>('[data-overlay-obstacle]') ?? [])
    ]
      .filter(
        (element) => !node.contains(element) && !element.closest('[inert]')
      )
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        x: rect.left - frame.left,
        y: rect.top - frame.top,
        width: rect.width,
        height: rect.height
      }))
    const [x, y] = overlayPosition(
      [left, top],
      { width: node.offsetWidth, height: node.offsetHeight },
      {
        width: parent?.clientWidth ?? innerWidth,
        height: parent?.clientHeight ?? innerHeight
      },
      obstacles
    )
    placement.position = [
      (x - 12) / Math.max(1, max.x - 12),
      (y - 12) / Math.max(1, max.y - 12)
    ]
    node.style.left = `${x}px`
    node.style.top = `${y}px`
    node.style.right = node.style.bottom = 'auto'
  }

  function resetStyles() {
    for (const property of ['left', 'top', 'right', 'bottom'])
      node.style.removeProperty(property)
  }

  function resize() {
    if (!enabled || drag) return
    const max = limits()
    const position = placement.position
    if (position)
      place(12 + position[0] * (max.x - 12), 12 + position[1] * (max.y - 12))
    else place(node.offsetLeft, node.offsetTop)
  }

  function end(cancel = false) {
    const previous = drag
    drag = undefined
    node.classList.remove('moving-overlay')
    if (!previous) return
    if (node.hasPointerCapture(previous.id))
      node.releasePointerCapture(previous.id)
    if (cancel) {
      placement.position = previous.previous
      if (placement.position) resize()
      else resetStyles()
    }
  }

  function down(event: PointerEvent) {
    if (
      !enabled ||
      event.button !== 0 ||
      !(event.target instanceof Element) ||
      !event.target.closest('[data-drag-handle]')
    )
      return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.target.closest('[data-drag-handle]')
    if (handle instanceof HTMLButtonElement)
      handle.focus({ preventScroll: true })
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: node.offsetLeft,
      top: node.offsetTop,
      previous: placement.position
    }
    node.classList.add('moving-overlay')
    node.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return
    event.preventDefault()
    place(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y)
  }

  function up(event: PointerEvent) {
    if (event.pointerId === drag?.id) end()
  }
  function cancel() {
    end(true)
  }
  function keydown(event: KeyboardEvent) {
    if (!enabled) return
    if (event.key === 'Escape' && drag) {
      event.preventDefault()
      event.stopPropagation()
      cancel()
      return
    }
    if (
      !(event.target instanceof Element) ||
      !event.target.closest('[data-drag-handle]')
    )
      return
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }
    const delta = direction[event.key]
    if (!delta) return
    event.preventDefault()
    event.stopPropagation()
    const step = event.shiftKey ? 40 : 10
    place(node.offsetLeft + delta[0] * step, node.offsetTop + delta[1] * step)
  }

  node.addEventListener('pointerdown', down)
  node.addEventListener('pointermove', move)
  node.addEventListener('pointerup', up)
  node.addEventListener('pointercancel', cancel)
  node.addEventListener('lostpointercapture', cancel)
  window.addEventListener('keydown', keydown, true)
  function scheduleResize() {
    if (disposed) return
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(resize)
  }
  const observer = new ResizeObserver(scheduleResize)
  observer.observe(node)
  if (node.parentElement) observer.observe(node.parentElement)
  queueMicrotask(() => {
    if (disposed) return
    app
      ?.querySelectorAll('[data-overlay-obstacle]')
      .forEach((element) => observer.observe(element))
    scheduleResize()
  })
  return {
    update(value) {
      const nextEnabled = typeof value === 'boolean' ? value : value.enabled
      const nextPlacement =
        typeof value === 'boolean' ? placement : value.placement
      if (enabled === nextEnabled && placement === nextPlacement) return
      end(true)
      if (placement !== nextPlacement) resetStyles()
      enabled = nextEnabled
      placement = nextPlacement
      if (enabled) scheduleResize()
      else resetStyles()
    },
    destroy() {
      disposed = true
      end()
      observer.disconnect()
      cancelAnimationFrame(resizeFrame)
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', cancel)
      node.removeEventListener('lostpointercapture', cancel)
      window.removeEventListener('keydown', keydown, true)
    }
  }
}
