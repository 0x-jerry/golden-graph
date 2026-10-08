import type { IVec2 } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import { GROUP_MIN_HEIGHT, GROUP_MIN_WIDTH } from '../constants'
import type { GestureContext, IGesture } from './types'

export class GroupResizeGesture implements IGesture {
  _groupId = 0
  _ctx: GestureContext

  constructor(_ctx: GestureContext) {
    this._ctx = _ctx
  }

  start(groupId: number) {
    this._groupId = groupId

    this._ctx.ws.setActiveIds(ActiveType.Group, [groupId])
  }

  move(screenPos: IVec2) {
    const { ws } = this._ctx
    const group = ws.groups.find((g) => g.id === this._groupId)
    if (!group) return

    // Same as the node grip: drag the bottom-right corner to the pointer.
    const corner = ws.coord.convertScreenCoord(screenPos)
    group.setSize({
      x: Math.max(GROUP_MIN_WIDTH, corner.x - group.pos.x),
      y: Math.max(GROUP_MIN_HEIGHT, corner.y - group.pos.y),
    })
  }

  end() {}
}
