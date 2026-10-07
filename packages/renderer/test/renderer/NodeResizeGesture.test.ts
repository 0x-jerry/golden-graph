import { describe, expect, it } from 'vitest'
import type Konva from 'konva'
import { createWorkspace } from '../helpers/workspace'
import {
  NodeResizeGesture,
} from '../../src/renderer/interaction/NodeResizeGesture'
import type { GestureContext } from '../../src/renderer/interaction/types'
import { getNodeStaticMinHeight } from '../../src/renderer/handles/layout'
import { LAYOUT } from '../../src/renderer/constants'

function makeGesture() {
  const ws = createWorkspace()
  const stage = {
    getPointerPosition: () => ({ x: 100, y: 100 }),
  } as unknown as Konva.Stage
  const gesture = new NodeResizeGesture({
    stage,
    ws,
    renderOverlay: () => {},
  } as GestureContext)
  return { ws, gesture }
}

/** `Sum` schema node: three inline handle rows (28px each). */
function addSizedNode(
  ws: ReturnType<typeof createWorkspace>,
  x: number,
  y: number,
) {
  const node = ws.addNode('Sum')!
  node.setSize({ x, y })
  return node
}

describe('NodeResizeGesture minimums', () => {
  it('clamps width/height to their minimums when shrinking', () => {
    const width = makeGesture()
    const wn = addSizedNode(width.ws, 300, 300)
    width.gesture.start(wn.id)
    width.gesture.move({ x: -300, y: 100 }) // dx = -400
    expect(wn.size.x).toBe(LAYOUT.NODE_WIDTH)

    const height = makeGesture()
    const hn = addSizedNode(height.ws, 300, 300)
    height.gesture.start(hn.id)
    height.gesture.move({ x: 100, y: -300 }) // dy = -400
    expect(hn.size.y).toBe(getNodeStaticMinHeight(hn))

    // shrinking both dimensions clamps both minimums at once
    const both = makeGesture()
    const bn = addSizedNode(both.ws, 300, 300)
    both.gesture.start(bn.id)
    both.gesture.move({ x: -300, y: -300 })
    expect(bn.size.x).toBe(LAYOUT.NODE_WIDTH)
    expect(bn.size.y).toBe(getNodeStaticMinHeight(bn))
  })

  it('still grows when dragging right and down', () => {
    const { ws, gesture } = makeGesture()
    const node = addSizedNode(ws, 0, 0)

    gesture.start(node.id)
    gesture.move({ x: 300, y: 300 }) // dx = dy = 200

    expect(node.size.x).toBeGreaterThan(LAYOUT.NODE_WIDTH)
    expect(node.size.y).toBeGreaterThan(getNodeStaticMinHeight(node))
  })
})