import { describe, it, expect } from 'vitest'
import Konva from 'konva'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { addHandle, makeEdge, makeNode } from '../helpers/entities'
import { EdgeView } from '../../src/renderer/EdgeView'
import { HandleView, setJointHighlight } from '../../src/renderer/HandleView'
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
import { COLORS, LAYOUT } from '../../src/renderer/constants'

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
    // Unconnected → dimmed type color.
    expect(view._joint!.fill()).toBe(jointColor(DEFAULT_JOINT_STYLE, 0.35))
    view.destroy()
  })

  it('uses full type color when connected and highlight while hovered', () => {
    const node = makeNode(3, 'C')
    const handle = addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: 'text',
    })
    const other = makeNode(4, 'D')
    const otherHandle = addHandle(other, 'in', { type: 'text' })

    const view = new HandleView(handle)
    expect(view._joint!.fill()).toBe(
      jointColor(resolveJointStyle(handle), 0.35),
    )

    handle._connectedHandle = otherHandle
    view.update()
    expect(view._joint!.fill()).toBe(jointColor(resolveJointStyle(handle), 1))

    setJointHighlight(handle, true)
    expect(view._joint!.fill()).toBe(COLORS.JOINT_HIGHLIGHT)

    setJointHighlight(handle, false)
    expect(view._joint!.fill()).toBe(jointColor(resolveJointStyle(handle), 1))
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
    expect(view._joint!.fill()).toBe(
      jointColor({ color: '#22d3ee', shape: 'triangle' }, 0.35),
    )
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
