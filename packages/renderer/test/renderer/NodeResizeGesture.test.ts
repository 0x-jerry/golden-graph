import { describe, expect, it } from 'vitest'
import type Konva from 'konva'
import type { IVec2 } from '@0x-jerry/golden-graph'
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
    getPointerPosition: () => ({ x: 0, y: 0 }),
  } as unknown as Konva.Stage
  const gesture = new NodeResizeGesture({
    stage,
    ws,
    renderOverlay: () => {},
  } as GestureContext)
  return { ws, gesture }
}

/** `Sum` schema node: three inline handle rows (28px each). */
function addNode(
  ws: ReturnType<typeof createWorkspace>,
  pos: IVec2,
  size?: IVec2,
) {
  const node = ws.addNode('Sum')!
  node.moveTo(pos.x, pos.y)
  if (size) node.setSize(size)
  return node
}

describe('NodeResizeGesture', () => {
  it('pins the bottom-right corner to the pointer', () => {
    const { ws, gesture } = makeGesture()
    const node = addNode(ws, { x: 10, y: 20 }, { x: 300, y: 300 })

    gesture.start(node.id)
    gesture.move({ x: 250, y: 300 })

    expect(node.size).toEqual({ x: 240, y: 280 })
  })

  it('grows an auto-sized node out to the pointer', () => {
    const { ws, gesture } = makeGesture()
    const node = addNode(ws, { x: 0, y: 0 })

    gesture.start(node.id)
    gesture.move({ x: 400, y: 400 })

    expect(node.size).toEqual({ x: 400, y: 400 })
  })

  it('clamps width/height to their minimums', () => {
    const { ws, gesture } = makeGesture()
    const node = addNode(ws, { x: 0, y: 0 }, { x: 300, y: 300 })

    gesture.start(node.id)
    gesture.move({ x: -300, y: -300 })

    expect(node.size.x).toBe(LAYOUT.NODE_WIDTH)
    expect(node.size.y).toBe(getNodeStaticMinHeight(node))
  })

  it('resyncs the corner to the pointer after a clamp', () => {
    const { ws, gesture } = makeGesture()
    const node = addNode(ws, { x: 0, y: 0 }, { x: 300, y: 300 })

    gesture.start(node.id)
    gesture.move({ x: -200, y: -200 })
    expect(node.size.x).toBe(LAYOUT.NODE_WIDTH)

    // The clamped overshoot must not shift the corner off the pointer.
    gesture.move({ x: 260, y: 300 })
    expect(node.size).toEqual({ x: 260, y: 300 })
  })

  it('follows the pointer through zoom and pan', () => {
    const { ws, gesture } = makeGesture()
    const node = addNode(ws, { x: 10, y: 20 }, { x: 300, y: 300 })

    ws.coord.zoomAt({ x: 0, y: 0 }, 2)
    ws.coord.move(20, 40)

    gesture.start(node.id)
    gesture.move({ x: 600, y: 700 })

    // screen (600, 700) → world (600/2 - 10, 700/2 - 20) = (290, 330)
    expect(node.size).toEqual({ x: 280, y: 310 })
  })
})
