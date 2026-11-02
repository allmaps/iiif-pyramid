import type { Point } from './geometry.ts'

export type Controller = Pick<Gamepad, 'id' | 'index' | 'mapping'>
type Pad = Controller & Pick<Gamepad, 'connected' | 'axes' | 'buttons'>
export type GamepadAction =
  | { type: 'move'; key: string }
  | { type: 'level'; direction: -1 | 1 }
  | { type: 'camera'; pan: Point; zoom: number }
  | { type: 'confirm' | 'back' | 'help' | 'overview' | 'locate' | 'grid' }

export function controllerLabels(id: string) {
  if (/playstation|dualsense|dualshock|sony|054c/i.test(id))
    return {
      confirm: '×',
      back: '○',
      locate: '□',
      overview: '△',
      left: 'L1',
      right: 'R1',
      out: 'L2',
      in: 'R2',
      help: 'Options',
      grid: '○'
    }
  const nintendo = /nintendo|057e/i.test(id)
  return {
    confirm: nintendo ? 'B' : 'A',
    back: nintendo ? 'A' : 'B',
    locate: nintendo ? 'Y' : 'X',
    overview: nintendo ? 'X' : 'Y',
    left: nintendo ? 'L' : 'LB',
    right: nintendo ? 'R' : 'RB',
    out: nintendo ? 'ZL' : 'LT',
    in: nintendo ? 'ZR' : 'RT',
    help: nintendo ? '+' : 'Menu',
    grid: nintendo ? 'A' : 'B'
  }
}

function deadZone(value: number, threshold = 0.2) {
  return Math.abs(value) > threshold
    ? (Math.sign(value) * (Math.min(1, Math.abs(value)) - threshold)) /
        (1 - threshold)
    : 0
}

/** Standard Gamepad indices: https://w3c.github.io/gamepad/#remapping */
export class GamepadReader {
  private controller?: Controller
  private context = ''
  private armed = false
  private held = new Map<string, number>()
  private previousTime?: number

  read(pads: (Pad | null)[], now: number, context: string) {
    const connected = pads.filter((pad): pad is Pad => !!pad?.connected)
    const standard = connected.filter((pad) => pad.mapping === 'standard')
    const pad =
      standard.find((pad) => pad.index === this.controller?.index) ??
      standard[0] ??
      connected[0]
    const actions: GamepadAction[] = []
    const changed =
      pad?.id !== this.controller?.id ||
      pad?.index !== this.controller?.index ||
      pad?.mapping !== this.controller?.mapping
    if (changed || context !== this.context || context === 'blocked') {
      this.armed = false
      this.held.clear()
      this.previousTime = undefined
    }
    this.context = context
    this.controller = pad && {
      id: pad.id,
      index: pad.index,
      mapping: pad.mapping
    }
    const result = { controller: this.controller, actions }
    if (!pad || pad.mapping !== 'standard' || context === 'blocked')
      return result
    const pressed = (index: number) =>
      pad.buttons[index]?.pressed || (pad.buttons[index]?.value ?? 0) > 0.5
    // Release controls after connecting, returning to the tab, or changing
    // dialogs/rounds. A held confirm must never submit the next round too.
    if (!this.armed) {
      this.armed =
        !pad.buttons.some(
          (button, index) =>
            index !== 10 &&
            index !== 11 &&
            (button.pressed || button.value > 0.15)
        ) && !pad.axes.some((axis) => Math.abs(axis) > 0.2)
      this.previousTime = now
      return result
    }
    const seconds =
      Math.max(0, Math.min(50, now - (this.previousTime ?? now))) / 1000
    this.previousTime = now
    const nextHeld = new Map<string, number>()
    const fire = (key: string, down: boolean, repeat?: number) => {
      if (!down) return false
      const next = this.held.get(key)
      const due = next === undefined || now >= next
      nextHeld.set(
        key,
        due ? now + (next === undefined ? 330 : (repeat ?? Infinity)) : next
      )
      if (!repeat) nextHeld.set(key, Infinity)
      return due
    }
    for (const [index, type] of [
      [1, ['help', 'score', 'modal'].includes(context) ? 'back' : 'grid'],
      [9, 'help'],
      [0, 'confirm'],
      [3, 'overview'],
      [2, 'locate']
    ] as const) {
      if (
        fire(type, !!pressed(index)) &&
        (type !== 'back' || ['help', 'score', 'modal'].includes(context))
      )
        actions.push({ type })
    }
    for (const [index, direction] of [
      [4, -1],
      [5, 1]
    ] as const) {
      if (
        fire(
          `level-${direction}`,
          !!pressed(index) && !pressed(index === 4 ? 5 : 4),
          240
        )
      )
        actions.push({ type: 'level', direction })
    }
    const dpad = [
      Number(!!pressed(15)) - Number(!!pressed(14)),
      Number(!!pressed(13)) - Number(!!pressed(12))
    ]
    const hasDpad = [12, 13, 14, 15].some(pressed)
    const [x, y] = hasDpad
      ? dpad
      : [deadZone(pad.axes[0] ?? 0, 0.45), deadZone(pad.axes[1] ?? 0, 0.45)]
    const key =
      x || y
        ? Math.abs(x) >= Math.abs(y)
          ? x < 0
            ? 'ArrowLeft'
            : 'ArrowRight'
          : y < 0
            ? 'ArrowUp'
            : 'ArrowDown'
        : undefined
    if (key && fire(key, true, 120)) actions.push({ type: 'move', key })
    const pan: Point = [
      deadZone(pad.axes[2] ?? 0) * seconds * 500,
      deadZone(pad.axes[3] ?? 0) * seconds * 500
    ]
    const zoom =
      (deadZone(pad.buttons[7]?.value ?? 0, 0.15) -
        deadZone(pad.buttons[6]?.value ?? 0, 0.15)) *
      seconds *
      1.6
    if (pan[0] || pan[1] || zoom) actions.push({ type: 'camera', pan, zoom })
    this.held = nextHeld
    return result
  }
}

/** Poll fresh snapshots; unsupported or policy-blocked browsers keep mouse/keys. */
export function watchGamepad(
  context: () => string,
  update: (controller: Controller | undefined, actions: GamepadAction[]) => void
) {
  if (typeof navigator.getGamepads !== 'function') return () => {}
  const reader = new GamepadReader()
  let frame = 0
  let disposed = false
  const poll = (now: number) => {
    if (disposed) return
    let pads: (Gamepad | null)[]
    try {
      pads = navigator.getGamepads()
    } catch {
      update(undefined, [])
      return
    }
    const state = reader.read(
      pads,
      now,
      document.hidden || !document.hasFocus() ? 'blocked' : context()
    )
    update(state.controller, state.actions)
    frame = requestAnimationFrame(poll)
  }
  frame = requestAnimationFrame(poll)
  return () => {
    disposed = true
    cancelAnimationFrame(frame)
  }
}
