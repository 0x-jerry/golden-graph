import type { IVec2 } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import type { GestureContext, IGesture } from './types'

export class NodeDragGesture implements IGesture {
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
    const dx = screenPos.x - this._lastPos.x
    const dy = screenPos.y - this._lastPos.y
    this._lastPos = { x: screenPos.x, y: screenPos.y }

    const wsDelta = { x: dx / ws.coord.scale, y: dy / ws.coord.scale }

    if (
      ws.state.activeType === ActiveType.Node &&
      ws.state.activeIds.length > 1
    ) {
      ws.moveActiveNodes(wsDelta)
    } else {
      ws.getNode(this._nodeId)?.move(wsDelta.x, wsDelta.y)
    }
  }

  end() {}
}
