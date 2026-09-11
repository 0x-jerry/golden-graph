import { describe, expect, it } from 'vitest'
import type Konva from 'konva'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { find } from '../helpers/konva'
import { makeStage } from '../helpers/stage'
import { NodeView } from '../../src/renderer/NodeView'
import {
  LAYOUT,
  HANDLE_CONTENT_X,
  HANDLE_NAME_WIDTH,
} from '../../src/renderer/constants'

const FULL_LABEL_WIDTH = LAYOUT.NODE_WIDTH - LAYOUT.HANDLE_PADDING * 2

describe('HandleView content layout under zoom', () => {
  it('keeps right-hand handle content aligned when resizing after zoom', () => {
    const node = makeNode(1, 'Foo')
    addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: 'text',
    })
    const view = new NodeView(node)

    const { stage, layer, container } = makeStage(2)
    layer.add(view.group)

    // Simulate a resize: re-runs module.update + _layoutContent.
    node.setSize({ x: 400, y: 0 })
    view.update()

    const content = find<Konva.Group>(view.group, '.content')
    const localWidth = content.getClientRect({ skipTransform: true }).width

    // offsetX must be the local (unscaled) content width, not width * zoom.
    expect(content.offsetX()).toBeCloseTo(localWidth)

    stage.destroy()
    container.remove()
  })

  it('starts block content at the row top when there is no label or position', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'out', {
      position: HandlePosition.None,
      type: 'display',
    })
    const view = new NodeView(node)

    const content = find<Konva.Group>(view.group, '.content')
    expect(content.y()).toBe(LAYOUT.HEADER_HEIGHT)
  })

  it('hides the label of an unnamed handle', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'out', { type: 'display' })
    addHandle(node, 'in', { type: 'display', name: 'Input' })
    const view = new NodeView(node)

    const labels = view.group.find<Konva.Text>('.label')
    expect(labels).toHaveLength(2)
    expect(labels[0]!.visible()).toBe(false)
    expect(labels[1]!.visible()).toBe(true)
  })
})

describe('HandleView label width', () => {
  it('spans the node width for a content-less right handle', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: '',
      name: 'Output',
    })
    const view = new NodeView(node)

    const label = find<Konva.Text>(view.group, '.label')
    expect(label.width()).toBe(FULL_LABEL_WIDTH)
    expect(label.x()).toBe(LAYOUT.HANDLE_PADDING)
    expect(label.align()).toBe('right')
  })

  it('keeps the fixed column for a right handle with content', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: 'number',
      name: 'Number',
    })
    const view = new NodeView(node)

    const label = find<Konva.Text>(view.group, '.label')
    expect(label.width()).toBe(HANDLE_NAME_WIDTH)
    expect(label.x()).toBe(
      LAYOUT.NODE_WIDTH - HANDLE_CONTENT_X - HANDLE_NAME_WIDTH,
    )
  })

  it('spans the node width for a block handle', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'in', {
      position: HandlePosition.Left,
      type: 'display',
      name: 'Input',
    })
    const view = new NodeView(node)

    const label = find<Konva.Text>(view.group, '.label')
    expect(label.width()).toBe(FULL_LABEL_WIDTH)
    expect(label.x()).toBe(LAYOUT.HANDLE_PADDING)
  })

  it('follows the node width on resize', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: '',
      name: 'Output',
    })
    const view = new NodeView(node)

    node.setSize({ x: 400, y: 0 })
    view.update()

    const label = find<Konva.Text>(view.group, '.label')
    expect(label.width()).toBe(400 - LAYOUT.HANDLE_PADDING * 2)
  })
})
