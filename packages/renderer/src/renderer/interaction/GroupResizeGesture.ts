import type { IVec2 } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import { GROUP_MIN_HEIGHT, GROUP_MIN_WIDTH } from '../constants'
import type { GestureContext, IGesture } from './types'

export class GroupResizeGesture implements IGesture {
  _groupId = 0
  _lastPos: IVec2 = { x: 0, y: 0 }
  _ctx: GestureContext

  constructor(_ctx: GestureContext) {
    this._ctx = _ctx
  }

  start(groupId: number) {
    const pos = this._ctx.stage.getPointerPosition()
    if (!pos) return

    this._groupId = groupId
    this._lastPos = { x: pos.x, y: pos.y }

    this._ctx.ws.setActiveIds(ActiveType.Group, [groupId])
  }

  move(screenPos: IVec2) {
    const { ws } = this._ctx
    const group = ws.groups.find((g) => g.id === this._groupId)
    if (!group) return

    const dx = (screenPos.x - this._lastPos.x) / ws.coord.scale
    const dy = (screenPos.y - this._lastPos.y) / ws.coord.scale
    this._lastPos = { x: screenPos.x, y: screenPos.y }

    group.setSize({
      x: Math.max(GROUP_MIN_WIDTH, group.size.x + dx),
      y: Math.max(GROUP_MIN_HEIGHT, group.size.y + dy),
    })
  }

  end() {}
}
