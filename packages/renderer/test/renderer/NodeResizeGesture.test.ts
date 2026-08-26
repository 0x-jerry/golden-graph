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
  it('clamps width to the default node width when shrinking', () => {
    const { ws, gesture } = makeGesture()
    const node = addSizedNode(ws, 300, 300)

    gesture.start(node.id)
    gesture.move({ x: -300, y: 100 }) // dx = -400

    expect(node.size.x).toBe(LAYOUT.NODE_WIDTH)
  })

  it('clamps height to the static content height when shrinking', () => {
    const { ws, gesture } = makeGesture()
    const node = addSizedNode(ws, 300, 300)

    gesture.start(node.id)
    gesture.move({ x: 100, y: -300 }) // dy = -400

    expect(node.size.y).toBe(getNodeStaticMinHeight(node))
  })

  it('does not clip the minimums when only one dimension shrinks', () => {
    const { ws, gesture } = makeGesture()
    const node = addSizedNode(ws, 300, 300)

    gesture.start(node.id)
    gesture.move({ x: -300, y: -300 }) // both shrink hard

    expect(node.size.x).toBe(LAYOUT.NODE_WIDTH)
    expect(node.size.y).toBe(getNodeStaticMinHeight(node))
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