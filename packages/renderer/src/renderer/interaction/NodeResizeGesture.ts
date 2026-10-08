import type { IVec2 } from '@0x-jerry/golden-graph'
import { LAYOUT } from '../constants'
import { getNodeStaticMinHeight } from '../handles/layout'
import type { GestureContext, IGesture } from './types'

export class NodeResizeGesture implements IGesture {
  _nodeId = 0
  _ctx: GestureContext

  constructor(_ctx: GestureContext) {
    this._ctx = _ctx
  }

  start(nodeId: number) {
    this._nodeId = nodeId
  }

  move(screenPos: IVec2) {
    const { ws } = this._ctx
    const node = ws.getNode(this._nodeId)
    if (!node) return

    // Drag the node's bottom-right corner to the pointer: an absolute size, not
    // an accumulation of movement deltas, so the corner can't trail the cursor
    // after a clamp or a content-driven resize. The floors keep the node
    // readable and stop block rows collapsing; taller content is still
    // contained/clipped above the static minimum (see `layoutRows`).
    const corner = ws.coord.convertScreenCoord(screenPos)
    node.setSize({
      x: Math.max(LAYOUT.NODE_WIDTH, corner.x - node.pos.x),
      y: Math.max(getNodeStaticMinHeight(node), corner.y - node.pos.y),
    })
  }

  end() {}
}
