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
import { RangeSlider } from '../../src/renderer/components/RangeSlider'
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

type RangeModule = Konva.Group & { _slider: RangeSlider; update(): void }

interface SlideableHandle {
  stage: Konva.Stage
  handle: NodeHandle
  slider: RangeSlider
  module: RangeModule
}

const mountedSliders: RangeSlider[] = []

afterEach(() => {
  for (const slider of mountedSliders.splice(0)) {
    slider.destroy()
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

function moduleOf(node: Node): RangeModule {
  const view = new NodeView(node)
  return find<Konva.Group>(view.group, '.content') as RangeModule
}

function sliderOf(node: Node): RangeSlider {
  return moduleOf(node)._slider
}

/** A handle mounted on a stage, so pointers and the value box can drive it. */
function mountRangeHandle(
  opts: { value?: number; options?: Record<string, unknown> } = {},
): SlideableHandle {
  const { node, handle } = makeRangeHandle(opts)
  const { stage, layer } = makeStage()
  const view = new NodeView(node)
  layer.add(view.group)
  stage.draw()
  const module = find<Konva.Group>(view.group, '.content') as RangeModule
  mountedSliders.push(module._slider)
  return { stage, handle, slider: module._slider, module }
}

function setPointer(stage: Konva.Stage, pos: { x: number; y: number }): void {
  stage.setPointersPositions(
    new MouseEvent('pointermove', { clientX: pos.x, clientY: pos.y }),
  )
}

function rectCenter(node: Konva.Node): { x: number; y: number } {
  const rect = node.getClientRect()
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

function pressTrack({ stage, slider }: SlideableHandle): void {
  setPointer(stage, rectCenter(slider._track))
  slider._hit.fire('mousedown')
}

function pressKey(key: 'ArrowUp' | 'ArrowDown'): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

describe('range handle', () => {
  it('is registered as a slider factory', () => {
    const factory = getHandleFactory('range')
    expect(typeof factory?.create).toBe('function')
  })

  it('defaults to 0..100 step 1 and shows the editable value box', () => {
    const slider = sliderOf(makeRangeHandle({ value: 50 }).node)
    expect(slider.getValue()).toBe(50)
    expect(slider._input.visible()).toBe(true)
    expect(slider._input.getValue()).toBe('50')
    expect(slider._thumb.x()).toBeGreaterThan(slider._track.x())
  })

  it('hides the value box when showEditableValue is false', () => {
    const shown = sliderOf(
      makeRangeHandle({ value: 50, options: { showEditableValue: true } }).node,
    )
    const plain = sliderOf(
      makeRangeHandle({ value: 50, options: { showEditableValue: false } })
        .node,
    )
    expect(plain._input.visible()).toBe(false)
    expect(plain._track.width()).toBeGreaterThan(shown._track.width())
  })

  it('drops the value box when the row is too narrow', () => {
    const slider = sliderOf(makeRangeHandle({ value: 50 }).node)
    expect(slider._input.visible()).toBe(true)
    slider.setWidth(40)
    expect(slider._input.visible()).toBe(false)
  })

  it('snaps and clamps the displayed value', () => {
    const over = sliderOf(makeRangeHandle({ value: 150 }).node)
    expect(over._input.getValue()).toBe('100')
    expect(over._thumb.x()).toBe(over._track.x() + over._track.width())

    const under = sliderOf(makeRangeHandle({ value: -20 }).node)
    expect(under._input.getValue()).toBe('0')

    const fractional = sliderOf(
      makeRangeHandle({
        value: 0.30000000000000004,
        options: { min: 0, max: 1, step: 0.1 },
      }).node,
    )
    expect(fractional._input.getValue()).toBe('0.3')
  })

  it('never writes to the handle while rendering', () => {
    const withValue = makeRangeHandle({ value: 50 })
    expect(sliderOf(withValue.node).getValue()).toBe(50)
    expect(withValue.handle.getValue()).toBe(50)

    const empty = makeRangeHandle()
    const slider = sliderOf(empty.node)
    expect(slider.getValue()).toBe(0)
    expect(slider._input.getValue()).toBe('0')
    expect(empty.handle.getValue()).toBe(undefined)

    // `update()`'s silent sync must not commit the rendered fallback.
    moduleOf(empty.node).update()
    expect(empty.handle.getValue()).toBe(undefined)
  })

  it('keeps the thumb while an update lands mid-drag', () => {
    const { node, handle } = makeRangeHandle({ value: 50 })
    const module = moduleOf(node)
    module._slider._startDrag()
    handle.setValue(80)

    module.update()
    expect(module._slider.getValue()).toBe(50)
  })

  it('commits a snapped value on the first press', () => {
    const mounted = mountRangeHandle()
    pressTrack(mounted)

    expect(mounted.handle.getValue()).toBe(50)
    expect(mounted.slider.pressed).toBe(true)
  })

  it('follows the pointer while dragging and stops on release', () => {
    const mounted = mountRangeHandle({ value: 50 })
    pressTrack(mounted)

    const track = mounted.slider._track.getClientRect()
    const y = rectCenter(mounted.slider._track).y

    setPointer(mounted.stage, { x: track.x + track.width, y })
    mounted.stage.fire('mousemove')
    expect(mounted.handle.getValue()).toBe(100)
    expect(mounted.slider._input.getValue()).toBe('100')

    mounted.stage.fire('mouseup')
    expect(mounted.slider.pressed).toBe(false)

    setPointer(mounted.stage, { x: track.x, y })
    mounted.stage.fire('mousemove')
    expect(mounted.handle.getValue()).toBe(100)
  })

  it('steps the box value with the arrow keys', () => {
    const mounted = mountRangeHandle({ value: 50 })
    mounted.slider._input._startEdit()

    pressKey('ArrowUp')
    expect(mounted.handle.getValue()).toBe(51)
    expect(mounted.slider._input.getValue()).toBe('51')

    pressKey('ArrowDown')
    pressKey('ArrowDown')
    expect(mounted.handle.getValue()).toBe(49)
  })

  it('clamps a stepped value at the bounds', () => {
    const mounted = mountRangeHandle({ value: 100 })
    mounted.slider._input._startEdit()

    pressKey('ArrowUp')
    expect(mounted.handle.getValue()).toBe(100)
    expect(mounted.slider._input.getValue()).toBe('100')
  })

  it('commits a typed value, snapped and clamped', () => {
    const mounted = mountRangeHandle({ value: 50 })
    const input = mounted.slider._input
    input._startEdit()
    input._model.setVal('250')
    input._stopEdit(true)

    expect(mounted.handle.getValue()).toBe(100)
    expect(input.getValue()).toBe('100')
  })

  it('restores the box without writing on an empty commit', () => {
    const mounted = mountRangeHandle({ value: 50 })
    const input = mounted.slider._input
    input._startEdit()
    input._model.setVal('')
    input._stopEdit(true)

    expect(mounted.handle.getValue()).toBe(50)
    expect(input.getValue()).toBe('50')
  })

  it('releases its listeners when destroyed mid-drag', () => {
    const mounted = mountRangeHandle({ value: 50 })
    pressTrack(mounted)
    expect(mounted.slider.pressed).toBe(true)

    mounted.slider.destroy()
    expect(mounted.slider.pressed).toBe(false)
    expect(() => mounted.stage.fire('mousemove')).not.toThrow()
  })
})
