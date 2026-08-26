import type { IVec2 } from '@0x-jerry/golden-graph'
import { LAYOUT, getNodeWidth } from '../constants'
import { getNodeHeight } from '../NodeView'
import { getNodeStaticMinHeight } from '../handles/layout'
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
      // A node can't be resized narrower than its default width, nor shorter
      // than its static content height — content stays readable and block
      // rows never collapse onto each other. Taller content is still
      // contained/clipped above the static minimum (see `layoutRows`).
      x: Math.max(LAYOUT.NODE_WIDTH, getNodeWidth(node) + dx),
      y: Math.max(
        getNodeStaticMinHeight(node),
        getNodeHeight(node) + dy,
      ),
    })
  }

  end() {}
}