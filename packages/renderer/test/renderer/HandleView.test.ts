import { describe, expect, it } from 'vitest'
import type Konva from 'konva'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { find } from '../helpers/konva'
import { makeStage } from '../helpers/stage'
import { NodeView } from '../../src/renderer/NodeView'
import { LAYOUT } from '../../src/renderer/constants'

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
})
