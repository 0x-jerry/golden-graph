import { afterEach, describe, expect, it } from 'vitest'
import Konva from 'konva'
import {
  HandlePosition,
  Workspace,
  type Node,
  type NodeHandle,
} from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { find } from '../helpers/konva'
import { makeStage } from '../helpers/stage'
import { NodeView } from '../../src/renderer/NodeView'
import { getHandleFactory } from '../../src/renderer/handles'
import { RangeField } from '../../src/renderer/components/numeric/RangeField'
import {
  DEFAULT_DRAG_SPEED,
  SCRUB_DRAG_THRESHOLD,
} from '../../src/renderer/components/scrub'
import { HIDDEN_CURSOR } from '../../src/renderer/cursor'
import {
  filterNumericText,
  formatValue,
  quantizeValue,
  resolveRange,
} from '../../src/renderer/numeric'

describe('numeric range options', () => {
  it('resolves defaults, reversed bounds and invalid steps', () => {
    expect(resolveRange({})).toEqual({ min: 0, max: 100, step: 1 })
    expect(resolveRange({ min: 10, max: -10 })).toEqual({
      min: -10,
      max: 10,
      step: 1,
    })
    for (const step of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveRange({ step }).step).toBe(1)
    }
    expect(
      resolveRange({ min: Number.NaN, max: Number.POSITIVE_INFINITY }),
    ).toEqual({ min: 0, max: 100, step: 1 })
  })

  it('snaps onto the step grid anchored at min without float noise', () => {
    const range = resolveRange({ min: 0, max: 1, step: 0.1 })
    expect(quantizeValue(0.30000000000000004, range)).toBe(0.3)
    expect(quantizeValue(0.26, range)).toBe(0.3)
    expect(quantizeValue(0.24, range)).toBe(0.2)
    expect(quantizeValue(-5, range)).toBe(0)
    expect(quantizeValue(5, range)).toBe(1)
    expect(quantizeValue(Number.NaN, range)).toBe(0)

    const offset = resolveRange({ min: 5, max: 20, step: 2 })
    expect(quantizeValue(8, offset)).toBe(9)

    // The `min`'s own precision survives a coarser step.
    const precise = resolveRange({ min: 0.25, max: 2, step: 0.1 })
    expect(quantizeValue(0.25, precise)).toBe(0.25)
    expect(quantizeValue(0.35, precise)).toBe(0.35)
  })

  it('clamps on a degenerate range and formats at step precision', () => {
    const pinned = resolveRange({ min: 3, max: 3 })
    expect(quantizeValue(9, pinned)).toBe(3)
    expect(formatValue(0.35, 0.01)).toBe('0.35')
    expect(formatValue(50, 1)).toBe('50')
    expect(filterNumericText('a1.5-b')).toBe('1.5-')
  })
})

type RangeModule = Konva.Group & { _field: RangeField; update(): void }

interface Mounted {
  stage: Konva.Stage
  handle: NodeHandle
  field: RangeField
  module: RangeModule
}

const mounted: Mounted[] = []

afterEach(() => {
  for (const m of mounted.splice(0)) {
    m.field.stopEdit(false)
    m.module.destroy()
    m.stage.destroy()
  }
})

function makeRangeHandle(
  opts: { value?: number; options?: Record<string, unknown> } = {},
): { node: Node; handle: NodeHandle } {
  const node = makeNode(1, 'Range')
  const handle = addHandle(node, 'value', {
    position: HandlePosition.Left,
    type: 'range',
    name: 'Value',
    ...(opts.options ? { options: opts.options } : {}),
  })
  if (opts.value !== undefined) {
    handle.setInitialValue(opts.value)
  }
  // `handle.setValue` emits on the node's workspace.
  new Workspace().addRawNode(node)
  return { node, handle }
}

/** A handle mounted on a stage, so pointer gestures can drive it. */
function mountRangeHandle(
  opts: { value?: number; options?: Record<string, unknown> } = {},
): Mounted {
  const { node, handle } = makeRangeHandle(opts)
  const { stage, layer } = makeStage()
  const view = new NodeView(node)
  layer.add(view.group)
  stage.draw()
  const module = find<Konva.Group>(view.group, '.content') as RangeModule
  const m = { stage, handle, field: module._field, module }
  mounted.push(m)
  return m
}

/** Press the bar itself — the scrub surface of the widget. */
function pressBar(field: RangeField, clientX = 100): void {
  field._surface.fire('mousedown', {
    cancelBubble: false,
    evt: new MouseEvent('mousedown', { clientX, clientY: 20 }),
  })
}

let pointerX = 100
function dragBy(px: number, init: MouseEventInit = {}): void {
  pointerX += px
  window.dispatchEvent(
    new MouseEvent('mousemove', { clientX: pointerX, ...init }),
  )
}

function release(): void {
  window.dispatchEvent(new MouseEvent('mouseup'))
}

function dblclickBar(field: RangeField): void {
  field._surface.fire('dblclick', {
    cancelBubble: false,
    evt: new MouseEvent('dblclick', { clientX: 100, clientY: 20 }),
  })
}

/** Share of the bar the progress fill paints. */
function progress(field: RangeField): number {
  return field._fill.width() / field.barWidth
}

function pressKey(key: 'ArrowUp' | 'ArrowDown'): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

describe('range handle', () => {
  it('is registered as a bar factory', () => {
    const factory = getHandleFactory('range')
    expect(typeof factory?.create).toBe('function')
  })

  it('draws a filled bar with the value at the end away from the joint', () => {
    const { field } = mountRangeHandle({ value: 50 })
    expect(field.displayed).toBe(50)
    expect(field._value.text()).toBe('50')
    expect(progress(field)).toBeCloseTo(0.5)
    // Left handle: the value sits at the right end of the bar.
    expect(field._value.align()).toBe('right')
    expect(field._value.x()).toBeGreaterThan(field._w / 2)
  })

  it('snaps and clamps the displayed value', () => {
    const over = mountRangeHandle({ value: 150 }).field
    expect(over.displayed).toBe(100)
    expect(progress(over)).toBeCloseTo(1)

    const under = mountRangeHandle({ value: -20 }).field
    expect(under.displayed).toBe(0)
    expect(progress(under)).toBe(0)

    const fractional = mountRangeHandle({
      value: 0.30000000000000004,
      options: { min: 0, max: 1, step: 0.1 },
    }).field
    expect(fractional._value.text()).toBe('0.3')
  })

  it('shows both step chevrons', () => {
    const { field } = mountRangeHandle({ value: 50 })
    expect(field._arrows.length).toBe(2)
    expect(field._arrows.map((a) => a.group.visible())).toEqual([true, true])
  })

  it('never writes to the handle while rendering', () => {
    const { node, handle } = makeRangeHandle()
    const { stage, layer } = makeStage()
    const view = new NodeView(node)
    layer.add(view.group)
    stage.draw()
    const module = find<Konva.Group>(view.group, '.content') as RangeModule
    const m = { stage, handle, field: module._field, module }
    mounted.push(m)

    expect(module._field.displayed).toBe(0)
    expect(handle.getValue()).toBe(undefined)
    module.update()
    expect(handle.getValue()).toBe(undefined)
  })

  it('does not jump the value to where the press landed', () => {
    const m = mountRangeHandle({ value: 50 })
    pressBar(m.field, 900)

    expect(m.handle.getValue()).toBe(50)
    expect(m.field.editing).toBe(false)
    release()
  })

  it('scrubs one step per dragSpeed pixels and stops on release', () => {
    const m = mountRangeHandle({ value: 50 })
    pointerX = 100
    pressBar(m.field)

    // The default drag is deliberately slow: DEFAULT_DRAG_SPEED px per step.
    dragBy(DEFAULT_DRAG_SPEED * 20)
    expect(m.handle.getValue()).toBe(70)
    expect(m.field._value.text()).toBe('70')
    expect(progress(m.field)).toBeCloseTo(0.7)

    dragBy(DEFAULT_DRAG_SPEED * -40)
    expect(m.handle.getValue()).toBe(30)
    expect(progress(m.field)).toBeCloseTo(0.3)

    release()
    dragBy(DEFAULT_DRAG_SPEED * 40)
    expect(m.handle.getValue()).toBe(30)
  })

  it('hides the pointer while the bar is being dragged', () => {
    const m = mountRangeHandle({ value: 50 })
    pointerX = 100
    m.stage.setPointersPositions(
      new MouseEvent('pointermove', { clientX: 100, clientY: 20 }),
    )
    pressBar(m.field)

    // A press alone keeps the pointer visible; a drag hides it under the bar.
    expect(m.stage.content.style.cursor).not.toBe(HIDDEN_CURSOR)
    dragBy(SCRUB_DRAG_THRESHOLD)
    expect(m.stage.content.style.cursor).toBe(HIDDEN_CURSOR)

    release()
    expect(m.stage.content.style.cursor).not.toBe(HIDDEN_CURSOR)
  })

  it('adds up many small moves instead of dropping the remainder', () => {
    const m = mountRangeHandle({ value: 50 })
    pointerX = 100
    pressBar(m.field)

    // A slow drag: 1px per frame, 80px in total = 10 steps at the default
    // speed. No single frame covers a whole step, so a per-frame
    // quantize-and-re-anchor would discard every one of them.
    for (let i = 0; i < 80; i++) {
      dragBy(1)
    }
    expect(m.handle.getValue()).toBe(60)

    // Two 1px moves back are only a quarter of a step: the bar holds.
    dragBy(-1)
    dragBy(-1)
    expect(m.handle.getValue()).toBe(60)
    release()
  })

  it('adds up multi-pixel moves that do not divide the speed', () => {
    const m = mountRangeHandle({ value: 50 })
    pointerX = 100
    pressBar(m.field)

    // 3px per frame against 8px/step: frames alternate between one step and
    // two, and the leftover keeps the total exact (120px = 15 steps).
    for (let i = 0; i < 40; i++) {
      dragBy(3)
    }
    expect(m.handle.getValue()).toBe(65)
    release()
  })

  it('clamps a scrub at the bounds and honours dragSpeed and modifiers', () => {
    const m = mountRangeHandle({ value: 50 })
    // 10x faster than the default, so 100px is 10 steps.
    m.field._scrub._speed = 10
    pointerX = 100
    pressBar(m.field)

    // The gesture's anchor is its starting value (50); every later move is
    // measured from there, so the travel from here on accumulates.
    dragBy(100, { ctrlKey: true })
    expect(m.handle.getValue()).toBe(51)

    // Travel is accumulated from the gesture's starting value (50), so this
    // helper expresses a drag as an exact number of steps.
    const steps = (n: number) => dragBy(n * m.field._scrub._speed)

    // Far past the lower bound it pins there and the fill empties. With the
    // 1 step already applied above, net travel is -499 steps.
    steps(-500)
    expect(m.handle.getValue()).toBe(0)
    expect(progress(m.field)).toBe(0)

    // Reversing responds at once: total travel is 1 step again, so the value
    // is back to 51 without having to re-cover the clamped-away distance.
    steps(500)
    expect(m.handle.getValue()).toBe(51)
    expect(progress(m.field)).toBeCloseTo(0.51)

    // And the far end clamps too.
    steps(1000)
    expect(m.handle.getValue()).toBe(100)
    expect(progress(m.field)).toBeCloseTo(1)
    release()
  })

  it('steps from the chevrons', () => {
    const m = mountRangeHandle({ value: 50 })
    const [left, right] = m.field._arrows

    right!.scrub._cfg.onStart?.()
    expect(m.handle.getValue()).toBe(51)
    left!.scrub._cfg.onStart?.()
    left!.scrub._cfg.onStart?.()
    expect(m.handle.getValue()).toBe(49)
  })

  it('opens the caret on a double-click, with the value selected', () => {
    const { field } = mountRangeHandle({ value: 50 })
    dblclickBar(field)

    expect(field.editing).toBe(true)
    expect(field._input.active).toBe(true)
    expect(field._input._model.selectedText()).toBe('50')
    // The painted value and the chevrons give way to the caret.
    expect(field._value.visible()).toBe(false)
    expect(field.arrows.every((a) => !a.group.visible())).toBe(true)

    field.stopEdit(false)
    expect(field.editing).toBe(false)
    expect(field._value.visible()).toBe(true)
  })

  it('returns to its normal look when the caret is blurred away', () => {
    const { field } = mountRangeHandle({ value: 50 })
    dblclickBar(field)
    expect(field._value.visible()).toBe(false)
    expect(field.arrows.every((a) => !a.group.visible())).toBe(true)

    // Blur / an outside click ends the edit session on the Input itself.
    field._input.deactivate()

    expect(field.editing).toBe(false)
    expect(field._value.visible()).toBe(true)
    expect(field.arrows.every((a) => a.group.visible())).toBe(true)
  })

  it('recovers the idle look from a repaint after an unfinished session', () => {
    const { field } = mountRangeHandle({ value: 50 })
    dblclickBar(field)
    // Simulate a session that ended without notifying the field at all.
    ;(field as unknown as { _editing: boolean })._editing = true
    field._input.deactivate()
    field.render()

    expect(field.editing).toBe(false)
    expect(field._value.visible()).toBe(true)
    expect(field.arrows.every((a) => a.group.visible())).toBe(true)
  })

  it('steps the typed value with the arrow keys', () => {
    const m = mountRangeHandle({ value: 50 })
    m.field.startEdit()

    pressKey('ArrowUp')
    expect(m.handle.getValue()).toBe(51)
    pressKey('ArrowDown')
    pressKey('ArrowDown')
    expect(m.handle.getValue()).toBe(49)
    m.field.stopEdit(false)
  })

  it('commits a typed value, snapped and clamped', () => {
    const m = mountRangeHandle({ value: 50 })
    m.field.startEdit()
    m.field._input._model.setVal('250')
    m.field.stopEdit(true)

    expect(m.handle.getValue()).toBe(100)
    expect(m.field._value.text()).toBe('100')
  })

  it('restores the value without writing on an empty commit', () => {
    const m = mountRangeHandle({ value: 50 })
    m.field.startEdit()
    m.field._input._model.setVal('')
    m.field.stopEdit(true)

    expect(m.handle.getValue()).toBe(50)
    expect(m.field._value.text()).toBe('50')
  })

  it('follows the node width across a resize', () => {
    const m = mountRangeHandle({ value: 50 })
    const before = m.field.barWidth
    m.field.setWidth(m.field._w + 40)
    expect(m.field.barWidth).toBeCloseTo(before + 40)
    expect(m.field._value.align()).toBe('right')
  })

  it('releases its listeners when destroyed mid-drag', () => {
    const m = mountRangeHandle({ value: 50 })
    pointerX = 100
    pressBar(m.field)
    expect(m.field._scrub.pressed).toBe(true)

    const value = m.handle.getValue()
    m.module.destroy()
    mounted.splice(mounted.indexOf(m), 1)
    expect(() => {
      dragBy(60)
      release()
    }).not.toThrow()
    expect(m.handle.getValue()).toBe(value)
  })
})
