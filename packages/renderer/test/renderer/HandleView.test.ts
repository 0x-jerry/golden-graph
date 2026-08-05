import { describe, expect, it } from 'vitest'
import Konva from 'konva'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { find } from '../helpers/konva'
import { NodeView } from '../../src/renderer/NodeView'

function makeStage(scale: number) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const stage = new Konva.Stage({
    container,
    width: 1000,
    height: 800,
  })
  stage.scale({ x: scale, y: scale })
  return { stage, container }
}

describe('HandleView content layout under zoom', () => {
  it('keeps right-hand handle content aligned when resizing after zoom', () => {
    const node = makeNode(1, 'Foo')
    addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: 'text',
    })
    const view = new NodeView(node)

    const { stage, container } = makeStage(2)
    const layer = new Konva.Layer()
    layer.add(view.group)
    stage.add(layer)

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
})
