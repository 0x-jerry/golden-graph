import { describe, it, expect } from 'vitest'
import Konva from 'konva'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { find } from '../helpers/konva'
import { NodeView } from '../../src/renderer/NodeView'
import { getHandleView } from '../../src/renderer/HandleView'
import { notifyContentResized } from '../../src/renderer/HandleView'
import {
  COLORS,
  LAYOUT,
  NODE_BODY_PADDING,
  CARET_SIZE,
} from '../../src/renderer/constants'
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

describe('NodeView collapse', () => {
  const collapsedHeight = LAYOUT.HEADER_HEIGHT

  it('renders header-only height when collapsed, ignoring manual size', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a')
    node.setCollapsed(true)

    const view = new NodeView(node)
    const body = find<Konva.Rect>(view.group, '.body')
    expect(body.height()).toBe(collapsedHeight)

    // A collapsed node keeps its stored size (restored on expand) but never
    // renders taller than the header band.
    node.setSize({ x: 0, y: 200 })
    view.update()
    expect(body.height()).toBe(collapsedHeight)
  })

  it('does not render the body while collapsed', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a')
    const view = new NodeView(node)
    const body = find<Konva.Rect>(view.group, '.body')

    expect(body.visible()).toBe(true)

    node.setCollapsed(true)
    view.update()
    expect(body.visible()).toBe(false)

    node.setCollapsed(false)
    view.update()
    expect(body.visible()).toBe(true)
  })

  it('accents the header instead of the body while collapsed and active', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a')
    const view = new NodeView(node)
    const header = find<Konva.Rect>(view.group, '.header')
    const body = find<Konva.Rect>(view.group, '.body')

    node.setCollapsed(true)
    view.update()
    view.setActive(true)
    expect(body.visible()).toBe(false)
    expect(header.stroke()).toBe(COLORS.ACCENT)

    // Expanding returns the accent to the body and clears the header.
    node.setCollapsed(false)
    view.update()
    expect(header.stroke()).toBe('')
    expect(body.stroke()).toBe(COLORS.ACCENT)

    view.setActive(false)
    expect(body.stroke()).toBe(COLORS.BORDER)
  })

  it('hides the handle layer (and its joints) while collapsed', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'out', { position: HandlePosition.Right, type: 'text' })

    const view = new NodeView(node)
    const layer = view.group.find('.handleLayer')[0]! as Konva.Group
    expect(layer.visible()).toBe(true)

    node.setCollapsed(true)
    view.update()
    expect(layer.visible()).toBe(false)

    node.setCollapsed(false)
    view.update()
    expect(layer.visible()).toBe(true)
  })

  it('hides the resize grip while collapsed even when active', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a')
    const view = new NodeView(node)
    const resize = find<Konva.Group>(view.group, '.resize')

    view.setActive(true)
    expect(resize.visible()).toBe(true)

    node.setCollapsed(true)
    view.update()
    view.setActive(true)
    expect(resize.visible()).toBe(false)

    node.setCollapsed(false)
    view.update()
    view.setActive(true)
    expect(resize.visible()).toBe(true)
  })

  it('renders a caret only for nodes with foldable content', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a')
    const view = new NodeView(node)
    expect(view.group.find('.caret').length).toBe(1)

    const empty = makeNode(2, 'M')
    const emptyView = new NodeView(empty)
    expect(emptyView.group.find('.caret').length).toBe(0)
  })

  it('keeps the caret slot clear of the title', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a')
    const view = new NodeView(node)

    const caret = view.group.find('.caret')[0]! as Konva.Group
    const name = find<Konva.Text>(view.group, '.name')
    // Title starts right of the caret's hit zone.
    expect(name.x()).toBeGreaterThan(caret.x() + CARET_SIZE / 2)
  })

  it('toggles collapse on caret click and rotates the chevron', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a')
    const view = new NodeView(node)
    const caret = view.group.find('.caret')[0]! as Konva.Group
    const body = find<Konva.Rect>(view.group, '.body')

    expect(node.collapsed).toBe(false)
    expect(caret.rotation()).toBe(0)

    caret.fire('click')
    expect(node.collapsed).toBe(true)
    view.update()
    expect(caret.rotation()).toBe(-90)
    expect(body.height()).toBe(collapsedHeight)
    expect(layerOf(view).visible()).toBe(false)

    caret.fire('click')
    expect(node.collapsed).toBe(false)
    view.update()
    expect(caret.rotation()).toBe(0)
    expect(layerOf(view).visible()).toBe(true)
  })

  it('constructs an already-collapsed node folded', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a')
    node.setCollapsed(true)

    // Bypass `update()`: the constructor must hide the layer itself.
    const view = new NodeView(node)
    expect(layerOf(view).visible()).toBe(false)
    expect(find<Konva.Rect>(view.group, '.body').height()).toBe(collapsedHeight)
  })
})

/** Handle layer group of a view (exists on every NodeView). */
function layerOf(view: NodeView): Konva.Group {
  const layer = view.group.find('.handleLayer')[0]
  if (!layer) throw new Error('handleLayer missing')
  return layer as Konva.Group
}

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

describe('NodeView block content containment', () => {
  const staticBlockRow = LAYOUT.HANDLE_ROW_HEIGHT * 2
  const staticNodeHeight =
    LAYOUT.HEADER_HEIGHT + NODE_BODY_PADDING + staticBlockRow

  it('keeps auto-height nodes static regardless of content', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'out', { type: 'display' })
    const handle = node.getHandle('out')!
    handle.setInitialValue('long text '.repeat(60))

    const view = new NodeView(node)
    const body = find<Konva.Rect>(view.group, '.body')

    // Always-contain: tall block content is clipped, never grown into.
    expect(body.height()).toBe(staticNodeHeight)
  })

  it('keeps a manual size even with tall content (content is clipped)', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'out', { type: 'display' })
    const handle = node.getHandle('out')!
    handle.setInitialValue('long text '.repeat(60))

    const view = new NodeView(node)
    node.setSize({ x: 0, y: 200 })
    view.update()

    const body = find<Konva.Rect>(view.group, '.body')
    expect(body.height()).toBe(200)
    expect(node.size.y).toBe(200)
  })

  it('does not grow the node via notifyContentResized', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'out', { type: 'display' })
    const handle = node.getHandle('out')!
    handle.setInitialValue('x')

    const view = new NodeView(node)
    const before = node.size.y

    const content = find<Konva.Group>(view.group, '.content')
    content.add(new Konva.Rect({ name: 'big', width: 100, height: 300 }))
    notifyContentResized(content)

    expect(node.size.y).toBe(before)
    expect(find<Konva.Rect>(view.group, '.body').height()).toBe(
      staticNodeHeight,
    )
  })

  it('clips handle content to the node boundary', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a')
    const view = new NodeView(node)
    const layer = view.group.find('.handleLayer')[0]! as Konva.Group

    // Default auto-width node (LAYOUT.NODE_WIDTH), content-driven height.
    expect(layer.clipWidth()).toBe(LAYOUT.NODE_WIDTH + LAYOUT.JOINT_RADIUS * 2)
    expect(layer.clipHeight()).toBe(staticNodeHeight)

    node.setSize({ x: 300, y: 160 })
    view.update()

    expect(layer.clipWidth()).toBe(300 + LAYOUT.JOINT_RADIUS * 2)
    expect(layer.clipHeight()).toBe(160)
  })
})
