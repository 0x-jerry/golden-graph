import { afterEach, describe, expect, it } from 'vitest'
import Konva from 'konva'
import { HandlePosition, Workspace } from '@0x-jerry/golden-graph'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { addHandle, makeNode } from '../helpers/entities'
import { find } from '../helpers/konva'
import { makeStage } from '../helpers/stage'
import { NodeView } from '../../src/renderer/NodeView'
import type { NodeHandleModule } from '../../src/renderer/handles/types'
import { TextModel } from '../../src/renderer/components/input/TextModel'
import {
  handleInputKeyDown,
  type InputKeyEnv,
} from '../../src/renderer/components/input/keyboard'
import { NumberField } from '../../src/renderer/components/numeric/NumberField'
import { DEFAULT_DRAG_SPEED } from '../../src/renderer/components/scrub'
import {
  filterNumericText,
  formatValue,
  quantizeValue,
  resolveRange,
} from '../../src/renderer/numeric'

type NumberModule = NodeHandleModule & {
  _field: NumberField
  update(): void
}

const modules: NumberModule[] = []
const stages: Konva.Stage[] = []

afterEach(() => {
  for (const module of modules.splice(0)) {
    module._field.stopEdit(false)
    module.destroy()
  }
  for (const stage of stages.splice(0)) {
    stage.destroy()
  }
})

/**
 * A handle mounted on a stage, so pointer gestures can drive it. Its writes go
 * through `handle.setValue`, which emits on the node's workspace.
 */
function mountNumberHandle(opts: {
  value?: number
  options?: Record<string, unknown>
}): { stage: Konva.Stage; handle: NodeHandle; field: NumberField } {
  const node = makeNode(1, 'Number')
  const handle = addHandle(node, 'value', {
    position: HandlePosition.Left,
    type: 'number',
    name: 'Value',
    ...(opts.options === undefined ? {} : { options: opts.options }),
  })
  if (opts.value !== undefined) {
    handle.setInitialValue(opts.value)
  }
  new Workspace().addRawNode(node)

  const { stage, layer } = makeStage()
  const view = new NodeView(node)
  layer.add(view.group)
  stage.draw()

  const module = find<Konva.Group>(view.group, '.content') as NumberModule
  modules.push(module)
  stages.push(stage)
  return { stage, handle, field: module._field }
}

function pressBar(field: NumberField, x = 100) {
  field._surface.fire('mousedown', {
    cancelBubble: false,
    evt: new MouseEvent('mousedown', { clientX: x, clientY: 20 }),
  })
}

function moveTo(x: number, init: MouseEventInit = {}) {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, ...init }))
}

function release() {
  window.dispatchEvent(new MouseEvent('mouseup'))
}

function dblclickBar(field: NumberField) {
  field._surface.fire('dblclick', {
    cancelBubble: false,
    evt: new MouseEvent('dblclick', { clientX: 100, clientY: 20 }),
  })
}

function pressKey(key: 'ArrowUp' | 'ArrowDown') {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

function keyEnv(step?: (delta: number) => void): InputKeyEnv {
  return {
    sync: () => {},
    blink: () => {},
    commit: () => {},
    cancel: () => {},
    clearHidden: () => {},
    ...(step ? { step } : {}),
  }
}

/** Which bound the stored value sits past, e.g. `'above'`. */
function outside(field: NumberField): string {
  const { below, above } = field._outOfRange()
  return below ? 'below' : above ? 'above' : ''
}

describe('number handle stepping', () => {
  it('steps by the configured amount without floating point noise', () => {
    const stepping = mountNumberHandle({ value: 1 })
    stepping.field.startEdit()

    pressKey('ArrowUp')
    expect(stepping.handle.getValue()).toBe(2)
    expect(stepping.field._input.getValue()).toBe('2')
    pressKey('ArrowDown')
    expect(stepping.handle.getValue()).toBe(1)
    pressKey('ArrowDown')
    expect(stepping.handle.getValue()).toBe(0)
    stepping.field.stopEdit(false)

    const half = mountNumberHandle({ value: 1, options: { step: 0.5 } })
    half.field.startEdit()
    pressKey('ArrowUp')
    expect(half.handle.getValue()).toBe(1.5)
    pressKey('ArrowUp')
    expect(half.handle.getValue()).toBe(2)
    half.field.stopEdit(false)

    const frac = mountNumberHandle({ value: 0.1, options: { step: 0.1 } })
    frac.field.startEdit()
    pressKey('ArrowUp')
    expect(frac.handle.getValue()).toBe(0.2)
    expect(frac.field._input.getValue()).toBe('0.2')
    frac.field.stopEdit(false)
  })

  it('falls back to 1 for a non-positive or invalid step', () => {
    for (const step of [0, -2, Number.NaN]) {
      const m = mountNumberHandle({ value: 1, options: { step } })
      m.field.startEdit()
      pressKey('ArrowUp')
      expect(m.handle.getValue()).toBe(2)
      m.field.stopEdit(false)
    }
  })

  it('routes arrows to the step hook when provided, otherwise leaves them to the model', () => {
    const model = new TextModel({ value: '1', measure: () => 0 })

    const plain = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      cancelable: true,
    })
    handleInputKeyDown(model, plain, keyEnv())
    expect(model.value).toBe('1')
    expect(plain.defaultPrevented).toBe(false)

    const deltas: number[] = []
    const env = keyEnv((delta) => deltas.push(delta))
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowUp'] as const) {
      const evt = new KeyboardEvent('keydown', { key, cancelable: true })
      handleInputKeyDown(model, evt, env)
      expect(evt.defaultPrevented).toBe(true)
    }

    expect(deltas).toEqual([1, -1, 1])
    expect(model.value).toBe('1')
  })
})

describe('number handle bar', () => {
  it('draws an unfilled bar with the value and no chevrons in range', () => {
    const { field } = mountNumberHandle({ value: 5 })
    expect(field.displayed).toBe(5)
    expect(field._value.text()).toBe('5')
    expect(field._fill.width()).toBe(0)
    expect(field.arrows.every((a) => !a.group.visible())).toBe(true)
  })

  it('does not open the caret on a single press', () => {
    const { handle, field } = mountNumberHandle({ value: 5 })
    pressBar(field)
    release()

    expect(field.editing).toBe(false)
    expect(handle.getValue()).toBe(5)
  })

  it('steps once per dragSpeed pixels of travel', () => {
    const { handle, field } = mountNumberHandle({ value: 5 })
    // The default is a deliberately slow drag: `DEFAULT_DRAG_SPEED` px/step.
    pressBar(field, 100)
    moveTo(100 + DEFAULT_DRAG_SPEED)
    expect(handle.getValue()).toBe(6)
    expect(field._value.text()).toBe('6')

    moveTo(100 + DEFAULT_DRAG_SPEED * 5)
    expect(handle.getValue()).toBe(10)

    moveTo(100 - DEFAULT_DRAG_SPEED * 5)
    expect(handle.getValue()).toBe(0)

    release()
    moveTo(400)
    expect(handle.getValue()).toBe(0)
  })

  it('moves by step / dragSpeed per pixel and keeps the float grid clean', () => {
    const { handle, field } = mountNumberHandle({
      value: 1,
      options: { step: 0.1 },
    })
    field._scrub._speed = 10
    pressBar(field, 0)
    // 10px = 1 step at this speed, and a fractional travel snaps back onto
    // the step grid.
    moveTo(10)
    expect(handle.getValue()).toBe(1.1)
    moveTo(13)
    expect(handle.getValue()).toBe(1.1)
    moveTo(20)
    expect(handle.getValue()).toBe(1.2)
    release()
  })

  it('scales the travel with Ctrl (finer) and Shift (coarser)', () => {
    const { handle, field } = mountNumberHandle({ value: 10 })
    const px = DEFAULT_DRAG_SPEED
    pressBar(field, 0)
    // 10 steps of travel, scaled to 1 by Ctrl.
    moveTo(px * 10, { ctrlKey: true })
    expect(handle.getValue()).toBe(11)
    // 10 steps of travel, scaled to 100 by Shift.
    moveTo(px * 20, { shiftKey: true })
    expect(handle.getValue()).toBe(111)
    release()
  })

  it('clamps a bounded field to its bounds', () => {
    const { handle, field } = mountNumberHandle({
      value: 5,
      options: { min: 0, max: 10, step: 1 },
    })
    pressBar(field, 0)
    moveTo(40)
    expect(handle.getValue()).toBe(10)
    expect(outside(field)).toBe('')
    moveTo(-100)
    expect(handle.getValue()).toBe(0)
    release()
  })

  it('raises a chevron at the bound a stored value fell past', () => {
    // A value can arrive out of range from the schema or another node, e.g.
    // an IOR pushed above its limit — the bar shows it and offers the way
    // back.
    const above = mountNumberHandle({
      value: 15.6,
      options: { min: 0, max: 10, step: 1 },
    })
    expect(above.field.displayed).toBe(10)
    expect(outside(above.field)).toBe('above')
    expect(above.field.arrows.map((a) => a.group.visible())).toEqual([
      false,
      true,
    ])
    above.field.arrows[1]!.scrub._cfg.onStart?.()
    expect(above.handle.getValue()).toBe(10)

    const below = mountNumberHandle({
      value: -5,
      options: { min: 0, max: 10, step: 1 },
    })
    expect(outside(below.field)).toBe('below')
    expect(below.field.arrows.map((a) => a.group.visible())).toEqual([
      true,
      false,
    ])
    below.field.arrows[0]!.scrub._cfg.onStart?.()
    expect(below.handle.getValue()).toBe(0)
  })

  it('keeps an unbounded field open', () => {
    const { handle, field } = mountNumberHandle({ value: -3 })
    expect(handle.getValue()).toBe(-3)
    expect(outside(field)).toBe('')
    expect(field.arrows.every((a) => !a.group.visible())).toBe(true)
  })

  it('opens the caret and selects the value on a double-click', () => {
    const { field } = mountNumberHandle({ value: 42 })
    dblclickBar(field)

    expect(field.editing).toBe(true)
    expect(field._input._model.selectedText()).toBe('42')
    field.stopEdit(false)
  })

  it('stops listening once destroyed mid-drag', () => {
    const { handle, field } = mountNumberHandle({ value: 5 })
    pressBar(field, 0)
    const module = modules[0]!
    module.destroy()
    modules.splice(modules.indexOf(module), 1)

    expect(() => {
      moveTo(50)
      release()
    }).not.toThrow()
    expect(handle.getValue()).toBe(5)
  })
})

describe('numeric helpers used by the bar', () => {
  it('quantizes and formats consistently', () => {
    const range = resolveRange({ min: 0, max: 10, step: 0.5 })
    expect(quantizeValue(4.24, range)).toBe(4)
    expect(formatValue(4.5, 0.5)).toBe('4.5')
    expect(filterNumericText('a-1.5b')).toBe('-1.5')
  })
})
