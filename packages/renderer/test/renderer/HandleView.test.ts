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
  it('spans or caps label width by handle kind and follows node resize', () => {
    const right = makeNode(1, 'N')
    addHandle(right, 'out', {
      position: HandlePosition.Right,
      type: '',
      name: 'Output',
    })
    const rightLabel = find<Konva.Text>(new NodeView(right).group, '.label')
    expect(rightLabel.width()).toBe(FULL_LABEL_WIDTH)
    expect(rightLabel.x()).toBe(LAYOUT.HANDLE_PADDING)
    expect(rightLabel.align()).toBe('right')

    const withContent = makeNode(1, 'N')
    addHandle(withContent, 'out', {
      position: HandlePosition.Right,
      type: 'number',
      name: 'Number',
    })
    const contentLabel = find<Konva.Text>(
      new NodeView(withContent).group,
      '.label',
    )
    expect(contentLabel.width()).toBe(HANDLE_NAME_WIDTH)
    expect(contentLabel.x()).toBe(
      LAYOUT.NODE_WIDTH - HANDLE_CONTENT_X - HANDLE_NAME_WIDTH,
    )

    const block = makeNode(1, 'N')
    addHandle(block, 'in', {
      position: HandlePosition.Left,
      type: 'display',
      name: 'Input',
    })
    const blockLabel = find<Konva.Text>(new NodeView(block).group, '.label')
    expect(blockLabel.width()).toBe(FULL_LABEL_WIDTH)
    expect(blockLabel.x()).toBe(LAYOUT.HANDLE_PADDING)

    const resized = makeNode(1, 'N')
    addHandle(resized, 'out', {
      position: HandlePosition.Right,
      type: '',
      name: 'Output',
    })
    const resizedView = new NodeView(resized)
    resized.setSize({ x: 400, y: 0 })
    resizedView.update()
    const resizedLabel = find<Konva.Text>(resizedView.group, '.label')
    expect(resizedLabel.width()).toBe(400 - LAYOUT.HANDLE_PADDING * 2)
  })
})
