import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GamepadReader,
  controllerLabels,
  watchGamepad
} from '../src/lib/gamepad.ts'

function pad(index = 0, id = 'Xbox Wireless Controller') {
  return {
    index,
    id,
    connected: true,
    mapping: 'standard' as GamepadMappingType,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({
      pressed: false,
      touched: false,
      value: 0
    }))
  }
}
function button(controller: ReturnType<typeof pad>, index: number, value = 1) {
  controller.buttons[index] = {
    pressed: value > 0.5,
    touched: value > 0,
    value
  }
}

test('standard controls move tiles, change levels, and use edge-triggered commands', () => {
  const reader = new GamepadReader(),
    controller = pad()
  reader.read([controller], 0, 'guessing')
  button(controller, 15)
  assert.deepEqual(reader.read([controller], 10, 'guessing').actions, [
    { type: 'move', key: 'ArrowRight' }
  ])
  assert.deepEqual(reader.read([controller], 100, 'guessing').actions, [])
  assert.equal(
    reader.read([controller], 340, 'guessing').actions[0]?.type,
    'move'
  )
  assert.deepEqual(reader.read([controller], 400, 'guessing').actions, [])
  assert.equal(
    reader.read([controller], 460, 'guessing').actions[0]?.type,
    'move'
  )
  button(controller, 15, 0)
  button(controller, 10)
  controller.axes[1] = -0.9
  assert.deepEqual(reader.read([controller], 470, 'guessing').actions, [
    { type: 'move', key: 'ArrowUp' }
  ])
  controller.axes[1] = 0
  button(controller, 10, 0)
  button(controller, 5)
  assert.deepEqual(reader.read([controller], 480, 'guessing').actions, [
    { type: 'level', direction: 1 }
  ])
  button(controller, 5, 0)
  for (const [index, type] of [
    [0, 'confirm'],
    [2, 'locate'],
    [3, 'overview'],
    [9, 'help'],
    [1, 'grid']
  ] as const) {
    button(controller, index)
    assert.deepEqual(reader.read([controller], 500, 'guessing').actions, [
      { type }
    ])
    assert.deepEqual(reader.read([controller], 2000, 'guessing').actions, [])
    button(controller, index, 0)
    reader.read([controller], 2010, 'guessing')
  }
})

test('B toggles the grid once while panning continues', () => {
  const reader = new GamepadReader(),
    controller = pad()
  reader.read([controller], 0, 'guessing')
  controller.axes[2] = 1
  button(controller, 1)
  const first = reader.read([controller], 20, 'guessing').actions
  assert.equal(first.filter((action) => action.type === 'grid').length, 1)
  assert.ok(first.some((action) => action.type === 'camera'))
  assert.ok(
    reader
      .read([controller], 1000, 'guessing')
      .actions.every((action) => action.type !== 'grid')
  )
  button(controller, 1, 0)
  reader.read([controller], 1010, 'guessing')
  button(controller, 1)
  assert.ok(
    reader
      .read([controller], 1020, 'guessing')
      .actions.some((action) => action.type === 'grid')
  )
})

test('B toggles the grid during play and dismisses popups', () => {
  for (const context of [
    'guessing-0',
    'revealed-1',
    'finished-5',
    'help',
    'score',
    'modal'
  ]) {
    const reader = new GamepadReader(),
      controller = pad()
    reader.read([controller], 0, context)
    button(controller, 1)
    assert.deepEqual(
      reader.read([controller], 10, context).actions,
      ['help', 'score', 'modal'].includes(context)
        ? [{ type: 'back' }]
        : [{ type: 'grid' }]
    )
  }
})

test('stick dead zones reject drift; the D-pad takes priority and opposite inputs cancel', () => {
  const reader = new GamepadReader(),
    controller = pad()
  reader.read([controller], 0, 'guessing')
  controller.axes = [0.4, -0.3, 0.19, -0.19]
  button(controller, 6, 0.1)
  assert.deepEqual(reader.read([controller], 10, 'guessing').actions, [])
  controller.axes[0] = 1
  button(controller, 13)
  assert.deepEqual(reader.read([controller], 20, 'guessing').actions, [
    { type: 'move', key: 'ArrowDown' }
  ])
  button(controller, 12)
  assert.deepEqual(reader.read([controller], 30, 'guessing').actions, [])
})

test('camera input scales with elapsed time and analog pressure, with capped frame gaps', () => {
  const reader = new GamepadReader(),
    controller = pad()
  reader.read([controller], 0, 'guessing')
  controller.axes[2] = 1
  controller.axes[3] = -1
  button(controller, 7)
  assert.deepEqual(reader.read([controller], 20, 'guessing').actions, [
    { type: 'camera', pan: [10, -10], zoom: 0.032 }
  ])
  const delayed = reader.read([controller], 1000, 'guessing').actions[0]
  assert.deepEqual(delayed, {
    type: 'camera',
    pan: [25, -25],
    zoom: 0.08000000000000002
  })
  controller.axes = [0, 0, 0, 0]
  button(controller, 6)
  assert.deepEqual(reader.read([controller], 1020, 'guessing').actions, [])
  button(controller, 7, 0)
  assert.equal(
    reader.read([controller], 1040, 'guessing').actions[0]?.type,
    'camera'
  )
})

test('held buttons cannot dismiss help and submit, advance two rounds, or act after a focus change', () => {
  const reader = new GamepadReader(),
    controller = pad()
  button(controller, 0)
  assert.deepEqual(reader.read([controller], 0, 'help').actions, [])
  button(controller, 0, 0)
  reader.read([controller], 10, 'help')
  button(controller, 0)
  assert.deepEqual(reader.read([controller], 20, 'help').actions, [
    { type: 'confirm' }
  ])
  for (const context of [
    'guessing-0',
    'revealed-1',
    'guessing-1',
    'blocked',
    'guessing-1'
  ]) {
    assert.deepEqual(reader.read([controller], 1000, context).actions, [])
  }
  button(controller, 0, 0)
  reader.read([controller], 1010, 'guessing-1')
  button(controller, 0)
  assert.deepEqual(reader.read([controller], 1020, 'guessing-1').actions, [
    { type: 'confirm' }
  ])
})

test('sparse controller slots, disconnects, replacements and unmapped devices are handled safely', () => {
  const reader = new GamepadReader(),
    controller = pad(2)
  assert.equal(
    reader.read([null, null, controller], 0, 'guessing').controller?.index,
    2
  )
  button(controller, 0)
  reader.read([null, null, controller], 10, 'guessing')
  controller.connected = false
  assert.equal(
    reader.read([null, null, controller], 20, 'guessing').controller,
    undefined
  )
  const replacement = pad(2, 'DualSense Wireless Controller')
  button(replacement, 0)
  assert.deepEqual(
    reader.read([null, null, replacement], 30, 'guessing').actions,
    []
  )
  const raw = pad(0, 'Unmapped controller')
  raw.mapping = ''
  button(raw, 0)
  assert.equal(
    reader.read([raw, null, replacement], 40, 'guessing').controller?.index,
    2
  )
  const unsupported = reader.read([raw], 50, 'guessing')
  assert.equal(unsupported.controller?.mapping, '')
  assert.deepEqual(unsupported.actions, [])
})

test('button names match common standard controller families', () => {
  assert.equal(controllerLabels('Xbox Wireless Controller').confirm, 'A')
  assert.equal(
    controllerLabels('Wireless Controller (Vendor: 054c Product: 0ce6)')
      .confirm,
    '×'
  )
  assert.equal(controllerLabels('Nintendo Switch Pro Controller').confirm, 'B')
  assert.equal(controllerLabels('Xbox Wireless Controller').grid, 'B')
  assert.equal(controllerLabels('DualSense').grid, '○')
  assert.equal(controllerLabels('Nintendo Switch Pro Controller').grid, 'A')
})

test('browser polling handles focus loss, permission failure, and cleanup without leaked frames', (t) => {
  const controller = pad()
  let callback: FrameRequestCallback | undefined
  let focused = true,
    denied = false,
    cancelled = 0
  const received: string[] = []
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator'
  )!
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      getGamepads: () => {
        if (denied) throw new Error('Policy blocked')
        return [null, controller]
      }
    }
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { hidden: false, hasFocus: () => focused }
  })
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (next: FrameRequestCallback) => {
      callback = next
      return 1
    }
  })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: () => {
      cancelled++
    }
  })
  t.after(() => {
    Object.defineProperty(globalThis, 'navigator', originalNavigator)
    for (const name of [
      'document',
      'requestAnimationFrame',
      'cancelAnimationFrame'
    ])
      Reflect.deleteProperty(globalThis, name)
  })
  const stop = watchGamepad(
    () => 'guessing',
    (_controller, actions) => {
      received.push(...actions.map((action) => action.type))
    }
  )
  callback!(0)
  button(controller, 0)
  callback!(10)
  focused = false
  callback!(20)
  focused = true
  callback!(30)
  assert.deepEqual(received, ['confirm'])
  denied = true
  callback = undefined
  // A pending frame is the only remaining poll; policy failure must not reschedule.
  const nextStop = watchGamepad(
    () => 'guessing',
    (_controller, actions) => assert.deepEqual(actions, [])
  )
  const pending = callback!
  callback = undefined
  pending(40)
  assert.equal(callback, undefined)
  nextStop()
  stop()
  assert.equal(cancelled, 2)
})

test('stick clicks have no action and do not block initial arming', () => {
  const reader = new GamepadReader(),
    controller = pad()
  button(controller, 10)
  button(controller, 11)
  reader.read([controller], 0, 'guessing')
  assert.deepEqual(reader.read([controller], 10, 'guessing').actions, [])
  button(controller, 15)
  assert.deepEqual(reader.read([controller], 20, 'guessing').actions, [
    { type: 'move', key: 'ArrowRight' }
  ])
})
