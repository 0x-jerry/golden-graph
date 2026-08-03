import { describe, it, expect } from 'vitest'
import type Konva from 'konva'
import { Group, HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle, makeEdge } from '../helpers/entities'
import { NodeView } from '../../src/renderer/NodeView'
import { GroupView } from '../../src/renderer/GroupView'
import { EdgeView } from '../../src/renderer/EdgeView'
import { getHandleView } from '../../src/renderer/HandleView'
import { COLORS } from '../../src/renderer/constants'

function find<T extends Konva.Node>(group: Konva.Group, sel: string): T {
  return group.findOne<T>(sel) as T
}

describe('NodeView', () => {
  it('wraps the group with the node id and syncs position/name/size', () => {
    const node = makeNode(1, 'Foo')
    addHandle(node, 'a')

    const view = new NodeView(node)

    expect(view.group.getAttr('elementId')).toBe(1)

    node.moveTo(10, 20)
    node.name = 'Bar'
    node.setSize({ x: 300, y: 200 })
    view.update()

    expect(view.group.x()).toBe(10)
    expect(view.group.y()).toBe(20)
    expect(find<Konva.Text>(view.group, '.name').text()).toBe('Bar')
    expect(find<Konva.Rect>(view.group, '.body').width()).toBe(300)
    expect(find<Konva.Rect>(view.group, '.body').height()).toBe(200)
  })

  it('renders one handle view per node handle', () => {
    const node = makeNode(2, 'B')
    addHandle(node, 'in1')
    addHandle(node, 'in2')

    const view = new NodeView(node)
    expect(view.group.find('.handle').length).toBe(2)
  })

  it('toggles active state border and resize grip', () => {
    const node = makeNode(3, 'C')
    addHandle(node, 'a')

    const view = new NodeView(node)
    const body = find<Konva.Rect>(view.group, '.body')

    expect(body.stroke()).toBe(COLORS.BORDER)

    view.setActive(true)
    expect(body.stroke()).toBe(COLORS.ACCENT)

    view.setActive(false)
    expect(body.stroke()).toBe(COLORS.BORDER)
  })

  it('shows the resize grip only while selected', () => {
    const node = makeNode(4, 'D')
    addHandle(node, 'a')

    const view = new NodeView(node)
    const resize = find<Konva.Group>(view.group, '.resize')

    expect(resize.visible()).toBe(false)

    view.setActive(true)
    expect(resize.visible()).toBe(true)
  })

  it('highlights the body while executing', () => {
    const node = makeNode(5, 'E')
    addHandle(node, 'a')

    const view = new NodeView(node)
    const body = find<Konva.Rect>(view.group, '.body')

    view.setExecuteHighlight(true, true)
    expect(body.shadowEnabled()).toBe(true)

    view.setExecuteHighlight(false, true)
    expect(body.shadowEnabled()).toBe(false)
  })

  it('unregisters its handle views on destroy', () => {
    const node = makeNode(6, 'F')
    const handle = addHandle(node, 'a')
    const view = new NodeView(node)

    expect(getHandleView(handle)).toBeDefined()

    view.destroy()
    expect(getHandleView(handle)).toBeUndefined()
  })
})

describe('GroupView', () => {
  it('syncs position/size/name and active stroke', () => {
    const group = new Group()
    group.id = 1
    group.setName('G')
    group.setSize({ x: 200, y: 100 })
    group.setPos({ x: 5, y: 5 })

    const view = new GroupView(group)
    view.update()

    expect(view.group.x()).toBe(5)
    expect(view.group.y()).toBe(5)
    expect(find<Konva.Text>(view.group, '.name').text()).toBe('G')
    expect(find<Konva.Rect>(view.group, '.body').width()).toBe(200)
  })

  it('toggles active group border', () => {
    const group = new Group()
    group.id = 2
    const view = new GroupView(group)
    const body = find<Konva.Rect>(view.group, '.body')

    view.setActive(true)
    expect(body.stroke()).toBe(COLORS.ACCENT)

    view.setActive(false)
    expect(body.stroke()).toBe(COLORS.GROUP_BORDER)
  })
})

describe('EdgeView', () => {
  it('builds a bezier line and updates geometry on node move', () => {
    const a = makeNode(1, 'A', { x: 0, y: 0 })
    addHandle(a, 'out', { position: HandlePosition.Right })
    const b = makeNode(2, 'B', { x: 300, y: 0 })
    addHandle(b, 'in', { position: HandlePosition.Left })

    const edge = makeEdge({ node: a, key: 'out' }, { node: b, key: 'in' })
    if (!edge) throw new Error('edge is null')

    const view = new EdgeView(edge)
    const line = find<Konva.Line>(view.group, '.edge-line')
    expect(line.points().length).toBe(8)

    const before = [...line.points()]
    b.moveTo(500, 100)
    view.update()

    const after = [...line.points()]
    expect(after).not.toEqual(before)
  })
})

describe('Konva shape construction in jsdom', () => {
  it('constructs views without a real browser canvas', () => {
    const node = makeNode(9, 'T')
    addHandle(node, 'a')

    expect(() => new NodeView(node)).not.toThrow()
  })
})