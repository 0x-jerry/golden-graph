import { describe, it, expect } from 'vitest'
import Konva from 'konva'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { addHandle, makeEdge, makeNode } from '../helpers/entities'
import { makeStage } from '../helpers/stage'
import { Input } from '../../src/renderer/components/input'
import { Select } from '../../src/renderer/components/select'
import { CaretHandle } from '../../src/renderer/components/CaretHandle'
import { EdgeView } from '../../src/renderer/EdgeView'
import {
  HandleView,
  getHandleView,
  setJointHighlight,
} from '../../src/renderer/HandleView'
import { KonvaGraphRenderer } from '../../src/renderer/KonvaGraphRenderer'
import { createWorkspace } from '../helpers/workspace'
import {
  DEFAULT_JOINT_STYLE,
  createJointShape,
  jointColor,
  resolveJointStyle,
} from '../../src/renderer/joint'
import {
  registerHandleFactory,
  getHandleFactory,
} from '../../src/renderer/handles'
import {
  attachStageCursorCenter,
  registerStageCursor,
} from '../../src/renderer/cursor'
import { COLORS, LAYOUT, JOINT_CURSOR } from '../../src/renderer/constants'

function movePointer(stage: Konva.Stage, x: number, y: number) {
  stage.content.dispatchEvent(
    new MouseEvent('mousemove', {
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 0,
      bubbles: true,
      cancelable: true,
    }),
  )
}

describe('resolveJointStyle', () => {
  it('maps each built-in handle type to its registered joint style', () => {
    const cases: Array<[string, string, string]> = [
      ['number', '#6366f1', 'circle'],
      ['text', '#10b981', 'square'],
      ['select', '#f59e0b', 'diamond'],
      ['display', '#8b5cf6', 'square'],
      ['image', '#f97316', 'diamond'],
      ['color', '#ec4899', 'circle'],
    ]
    for (const [type, color, shape] of cases) {
      const node = makeNode(1, 'A')
      const handle = addHandle(node, 'h', { type })
      expect(resolveJointStyle(handle)).toEqual({ color, shape })
    }
  })

  it('falls back to the default style for unknown/empty types', () => {
    const node = makeNode(1, 'A')
    const handle = addHandle(node, 'h', { type: '' })
    expect(resolveJointStyle(handle)).toBe(DEFAULT_JOINT_STYLE)
  })
})

describe('jointColor', () => {
  it('converts hex colors to rgba at the given alpha', () => {
    expect(jointColor({ color: '#ff0000', shape: 'circle' }, 0.5)).toBe(
      'rgba(255, 0, 0, 0.5)',
    )
    expect(jointColor({ color: '#f0f', shape: 'circle' }, 0.35)).toBe(
      'rgba(255, 0, 255, 0.35)',
    )
  })

  it('returns non-hex colors unchanged', () => {
    expect(jointColor({ color: 'rgb(1, 2, 3)', shape: 'circle' }, 0.5)).toBe(
      'rgb(1, 2, 3)',
    )
  })
})

describe('HandleView joint rendering', () => {
  it('renders a Konva.Shape joint tinted by the handle type', () => {
    const node = makeNode(2, 'B')
    const handle = addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: '',
    })

    const view = new HandleView(handle)
    expect(view._joint).toBeInstanceOf(Konva.Shape)
    // Unconnected joints keep their full type color.
    expect(view._joint!.fill()).toBe(DEFAULT_JOINT_STYLE.color)
    view.destroy()
  })

  it('uses the full type color connected and while hovered', () => {
    const node = makeNode(3, 'C')
    const handle = addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: 'text',
    })
    const other = makeNode(4, 'D')
    const otherHandle = addHandle(other, 'in', { type: 'text' })

    const view = new HandleView(handle)
    expect(view._joint!.fill()).toBe(resolveJointStyle(handle).color)

    handle._connectedHandle = otherHandle
    view.update()
    expect(view._joint!.fill()).toBe(resolveJointStyle(handle).color)

    setJointHighlight(handle, true)
    expect(view._joint!.fill()).toBe(COLORS.JOINT_HIGHLIGHT)

    setJointHighlight(handle, false)
    expect(view._joint!.fill()).toBe(resolveJointStyle(handle).color)
    view.destroy()
  })
})

describe('registerHandleFactory', () => {
  it('registers a joint-only type (no widget) by handle type', () => {
    registerHandleFactory({
      type: '__joint_new',
      config: { joint: { color: '#22d3ee', shape: 'triangle' } },
    })

    const node = makeNode(5, 'E')
    const handle = addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: '__joint_new',
    })

    expect(resolveJointStyle(handle)).toEqual({
      color: '#22d3ee',
      shape: 'triangle',
    })

    const view = new HandleView(handle)
    expect(view._factory).toBeDefined()
    expect(view._module).toBeNull()
    expect(view._joint!.fill()).toBe('#22d3ee')
    view.destroy()
  })

  it('merges config when restyling an existing type (keeps layout + widget)', () => {
    const original = getHandleFactory('display')!
    registerHandleFactory({
      type: 'display',
      config: { joint: { color: '#123456', shape: 'square' } },
    })

    const merged = getHandleFactory('display')!
    expect(merged.config!.layout).toBe('block')
    expect(merged.config!.joint).toEqual({ color: '#123456', shape: 'square' })
    expect(merged.create).toBe(original.create)

    // Restore the built-in config for other tests.
    registerHandleFactory(original)
    expect(getHandleFactory('display')!.config!.joint).toEqual(
      original.config!.joint,
    )
  })
})

describe('stage cursor feedback', () => {
  it('shows an I-beam over an editable handle widget and clears on leave', () => {
    const input = new Input({ inputWidth: 120, inputHeight: 18, value: 'hi' })
    const { stage, layer, container } = makeStage(1)
    layer.add(input)
    stage.draw()
    const detach = attachStageCursorCenter(stage)
    const cursor = () => stage.content.style.cursor

    try {
      expect(cursor()).toBe('')
      movePointer(stage, 60, 9)
      expect(cursor()).toBe('text')
      movePointer(stage, 500, 400)
      expect(cursor()).toBe('')
    } finally {
      detach()
      stage.destroy()
      container.remove()
    }
  })

  it('shows pointer over the select widget and clears on leave', () => {
    const select = new Select({
      selectWidth: 120,
      selectHeight: 18,
      options: ['a', 'b'],
      value: 'a',
    })
    const { stage, layer, container } = makeStage(1)
    layer.add(select)
    stage.draw()
    const detach = attachStageCursorCenter(stage)
    const cursor = () => stage.content.style.cursor

    try {
      expect(cursor()).toBe('')
      movePointer(stage, 60, 9)
      expect(cursor()).toBe('pointer')
      movePointer(stage, 500, 400)
      expect(cursor()).toBe('')
    } finally {
      detach()
      stage.destroy()
      container.remove()
    }
  })

  it('shows pointer over the node expand/collapse caret and clears on leave', () => {
    const caret = new CaretHandle()
    const { stage, layer, container } = makeStage(1)
    layer.add(caret)
    stage.draw()
    const detach = attachStageCursorCenter(stage)
    const cursor = () => stage.content.style.cursor

    try {
      expect(cursor()).toBe('')
      movePointer(stage, 0, 0)
      expect(cursor()).toBe('pointer')
      movePointer(stage, 500, 400)
      expect(cursor()).toBe('')
    } finally {
      detach()
      stage.destroy()
      container.remove()
    }
  })

  it('shows pointer over the edge close button and clears on leave', () => {
    const a = makeNode(20, 'A')
    const b = makeNode(21, 'B')
    addHandle(a, 'out', { position: HandlePosition.Right, type: 'number' })
    addHandle(b, 'in', { position: HandlePosition.Left, type: 'number' })
    const edge = makeEdge({ node: a, key: 'out' }, { node: b, key: 'in' })!

    const view = new EdgeView(edge)
    const { stage, layer, container } = makeStage(1)
    layer.add(view.group)
    view.closeButton.visible(true)
    stage.draw()
    const detach = attachStageCursorCenter(stage)
    const cursor = () => stage.content.style.cursor
    const pos = view.closeButton.getAbsolutePosition()

    try {
      expect(cursor()).toBe('')
      movePointer(stage, pos.x, pos.y)
      expect(cursor()).toBe('pointer')
      movePointer(stage, 500, 400)
      expect(cursor()).toBe('')
    } finally {
      detach()
      stage.destroy()
      container.remove()
    }
  })

  it('re-asserts the hover cursor after node views are re-created', async () => {
    const ws = createWorkspace()
    ws.addNode('Number').moveTo(0, 0)
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    const renderer = new KonvaGraphRenderer(container, ws)
    renderer.stage.draw()
    const el = renderer.stage.content
    const cx = 12
    const cy = 15
    const cursor = () => renderer.stage.content.style.cursor

    try {
      el.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: cx,
          clientY: cy,
          button: 0,
          buttons: 0,
          bubbles: true,
          cancelable: true,
        }),
      )
      expect(cursor()).toBe('pointer')

      // Recreate every node view (as collapse/selection re-renders do) while
      // the pointer is stationary over the caret.
      renderer._store.renderAll()
      await new Promise((r) => requestAnimationFrame(r))

      expect(cursor()).toBe('pointer')
    } finally {
      renderer.dispose()
      container.remove()
    }
  })
})

describe('EdgeView stroke', () => {
  it('follows the source (output) port color, not the input or connect order', () => {
    const a = makeNode(6, 'A')
    const b = makeNode(7, 'B')
    const out = addHandle(a, 'out', {
      position: HandlePosition.Right,
      type: 'number',
    })
    const inn = addHandle(b, 'in', {
      position: HandlePosition.Left,
      type: 'text',
    })
    const expected = jointColor(resolveJointStyle(out), 0.5)
    expect(expected).not.toBe(jointColor(resolveJointStyle(inn), 0.5))

    // Normal connect(order): output → input.
    const edge = makeEdge({ node: a, key: 'out' }, { node: b, key: 'in' })!
    expect(new EdgeView(edge)._line.stroke()).toBe(expected)

    // Reversed connect order still colors by the right-side output.
    const reversed = makeEdge({ node: b, key: 'in' }, { node: a, key: 'out' })!
    expect(new EdgeView(reversed)._line.stroke()).toBe(expected)
  })

  it('createJointShape centers the shape at its position like the old circle', () => {
    const shape = createJointShape({ color: '#fff', shape: 'square' })
    shape.position({ x: 50, y: 40 })
    shape.fill('#fff')
    expect(shape).toBeInstanceOf(Konva.Shape)
    // Local origin is the center — no offset shifts the joint off x/y.
    expect(shape.offsetX()).toBe(0)
    expect(shape.offsetY()).toBe(0)
    const rect = shape.getClientRect()
    expect(rect.x).toBeCloseTo(50 - LAYOUT.JOINT_RADIUS, 0)
    expect(rect.y).toBeCloseTo(40 - LAYOUT.JOINT_RADIUS, 0)
    expect(rect.width).toBeCloseTo(LAYOUT.JOINT_RADIUS * 2, 0)
    expect(rect.height).toBeCloseTo(LAYOUT.JOINT_RADIUS * 2, 0)
  })
})

describe('joint cursor', () => {
  it('sets the stage cursor over a joint and clears on leave', () => {
    const ws = createWorkspace()
    ws.addNode('Number').moveTo(0, 0)
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })

    const renderer = new KonvaGraphRenderer(container, ws)
    renderer.stage.draw()
    const joint = getHandleView(ws.nodes[0]!.getHandle('value')!)!._joint!
    const pos = joint.getAbsolutePosition()
    const cursor = () => renderer.stage.content.style.cursor

    try {
      expect(cursor()).toBe('')

      movePointer(renderer.stage, pos.x, pos.y)
      expect(cursor()).toBe(JOINT_CURSOR)

      movePointer(renderer.stage, 500, 400)
      expect(cursor()).toBe('')
    } finally {
      renderer.dispose()
    }
  })
})

describe('cursor center', () => {
  it('walks up to the nearest registered ancestor of the hit shape', () => {
    const { stage, layer, container } = makeStage(1)
    const group = new Konva.Group({ x: 100, y: 100 })
    registerStageCursor(group, 'pointer')
    group.add(new Konva.Rect({ width: 50, height: 50, fill: 'red' }))
    layer.add(group)
    stage.draw()
    const detach = attachStageCursorCenter(stage)

    try {
      expect(stage.content.style.cursor).toBe('')
      movePointer(stage, 125, 125)
      expect(stage.content.style.cursor).toBe('pointer')
    } finally {
      detach()
      stage.destroy()
      container.remove()
    }
  })

  it('clears the cursor when the pointer leaves the stage content', () => {
    const { stage, layer, container } = makeStage(1)
    const rect = new Konva.Rect({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fill: 'red',
    })
    registerStageCursor(rect, 'pointer')
    layer.add(rect)
    stage.draw()
    const detach = attachStageCursorCenter(stage)

    try {
      movePointer(stage, 25, 25)
      expect(stage.content.style.cursor).toBe('pointer')

      stage.content.dispatchEvent(new MouseEvent('pointerleave'))
      expect(stage.content.style.cursor).toBe('')
    } finally {
      detach()
      stage.destroy()
      container.remove()
    }
  })

  it('clears the cursor when the hovered element is hidden', async () => {
    const { stage, layer, container } = makeStage(1)
    const rect = new Konva.Rect({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fill: 'red',
    })
    registerStageCursor(rect, 'pointer')
    layer.add(rect)
    stage.draw()
    const detach = attachStageCursorCenter(stage)

    try {
      movePointer(stage, 25, 25)
      expect(stage.content.style.cursor).toBe('pointer')

      // Hiding without pointer movement fires no pointermove; the layer redraw
      // must drop the now-invisible element from the hit test and clear it.
      rect.visible(false)
      layer.draw()
      await Promise.resolve()

      expect(stage.content.style.cursor).toBe('')
    } finally {
      detach()
      stage.destroy()
      container.remove()
    }
  })

  it('clears the cursor when the hovered element is destroyed', async () => {
    const { stage, layer, container } = makeStage(1)
    const rect = new Konva.Rect({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fill: 'red',
    })
    registerStageCursor(rect, 'pointer')
    layer.add(rect)
    stage.draw()
    const detach = attachStageCursorCenter(stage)

    try {
      movePointer(stage, 25, 25)
      expect(stage.content.style.cursor).toBe('pointer')

      rect.destroy()
      layer.draw()
      await Promise.resolve()

      expect(stage.content.style.cursor).toBe('')
    } finally {
      detach()
      stage.destroy()
      container.remove()
    }
  })
})
