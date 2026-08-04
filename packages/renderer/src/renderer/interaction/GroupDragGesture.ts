import type { IVec2 } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import type { GestureContext, IGesture } from './types'

export class GroupDragGesture implements IGesture {
  _groupId = 0
  _lastPos: IVec2 = { x: 0, y: 0 }
  _ctx: GestureContext

  constructor(_ctx: GestureContext) {
    this._ctx = _ctx
  }

  start(groupId: number) {
    const pos = this._ctx.stage.getPointerPosition()
    if (!pos) return

    const group = this._ctx.ws.groups.find((g) => g.id === groupId)
    if (!group) return

    this._groupId = groupId
    this._lastPos = { x: pos.x, y: pos.y }

    this._ctx.ws.setActiveIds(ActiveType.Group, [groupId])
  }

  move(screenPos: IVec2) {
    const { ws } = this._ctx
    const dx = screenPos.x - this._lastPos.x
    const dy = screenPos.y - this._lastPos.y
    this._lastPos = { x: screenPos.x, y: screenPos.y }

    const group = ws.groups.find((g) => g.id === this._groupId)
    if (group) {
      group.move({ x: dx / ws.coord.scale, y: dy / ws.coord.scale })
    }
  }

  end() {}
}
