import type { IVec2 } from '@0x-jerry/golden-graph'
import { NODE_MIN_WIDTH, getNodeWidth } from '../constants'
import { getNodeHeight } from '../NodeView'
import type { GestureContext, IGesture } from './types'

export class NodeResizeGesture implements IGesture {
  _nodeId = 0
  _lastPos: IVec2 = { x: 0, y: 0 }
  _ctx: GestureContext

  constructor(_ctx: GestureContext) {
    this._ctx = _ctx
  }

  start(nodeId: number) {
    const pos = this._ctx.stage.getPointerPosition()
    if (!pos) return

    this._nodeId = nodeId
    this._lastPos = { x: pos.x, y: pos.y }
  }

  move(screenPos: IVec2) {
    const { ws } = this._ctx
    const node = ws.getNode(this._nodeId)
    if (!node) return

    const dx = (screenPos.x - this._lastPos.x) / ws.coord.scale
    const dy = (screenPos.y - this._lastPos.y) / ws.coord.scale
    this._lastPos = { x: screenPos.x, y: screenPos.y }

    node.setSize({
      // Baseline from the effective width so an auto-width node doesn't jump
      // straight to the minimum when the first drag goes left.
      x: Math.max(NODE_MIN_WIDTH, getNodeWidth(node) + dx),
      // Baseline from the effective height: an auto-height node (`size.y` = 0)
      // renders at its content height, so without this the first ~content
      // height pixels of downward drag would produce no visible change. The
      // renderer still clamps the body so it never shrinks below content.
      y: Math.max(0, getNodeHeight(node) + dy),
    })
  }

  end() {}
}
