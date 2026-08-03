import type { IVec2 } from '@0x-jerry/golden-graph'
import type { GestureContext } from './types'

export class CanvasPanGesture {
  _lastPos: IVec2 = { x: 0, y: 0 }
  _ctx: GestureContext

  constructor(_ctx: GestureContext) {
    this._ctx = _ctx
  }

  start() {
    const pos = this._ctx.stage.getPointerPosition()
    if (!pos) return

    this._lastPos = { x: pos.x, y: pos.y }
  }

  move(screenPos: IVec2) {
    const dx = screenPos.x - this._lastPos.x
    const dy = screenPos.y - this._lastPos.y
    this._lastPos = { x: screenPos.x, y: screenPos.y }

    this._ctx.ws.coord.move(dx, dy)
  }

  end() {}
}
