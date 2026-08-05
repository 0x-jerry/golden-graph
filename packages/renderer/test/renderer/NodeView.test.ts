import { describe, it, expect } from 'vitest'
import type Konva from 'konva'
import { makeNode, addHandle } from '../helpers/entities'
import { find } from '../helpers/konva'
import { NodeView } from '../../src/renderer/NodeView'
import { getHandleView } from '../../src/renderer/HandleView'
import { COLORS } from '../../src/renderer/constants'
import { SubGraph, SubGraphNode, Workspace } from '@0x-jerry/golden-graph'

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

describe('Konva shape construction in jsdom', () => {
  it('constructs views without a real browser canvas', () => {
    const node = makeNode(9, 'T')
    addHandle(node, 'a')

    expect(() => new NodeView(node)).not.toThrow()
  })
})

describe('NodeView sub-graph tag', () => {
  it('renders a tag on the right of the title for SubGraphNodes', () => {
    const subGraph = new SubGraph(new Workspace())
    subGraph.id = 10

    const node = new SubGraphNode(subGraph)
    node.id = 1
    node.name = 'Group'
    node.setWorkspace(new Workspace())

    const view = new NodeView(node)
    const tag = view.group.find('.tag')[0]!

    expect(tag).toBeDefined()
    // anchored to the right side of the header, not the top-left corner
    expect(tag.x()).toBeGreaterThan(0)
    expect(tag.y()).toBeGreaterThan(0)
  })

  it('does not render a tag for normal nodes', () => {
    const node = makeNode(2, 'B')
    addHandle(node, 'a')

    const view = new NodeView(node)
    expect(view.group.find('.tag').length).toBe(0)
  })
})
