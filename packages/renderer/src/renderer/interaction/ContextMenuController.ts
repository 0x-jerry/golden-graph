import type Konva from 'konva'
import type { Workspace } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import { buildDefaultContextMenu } from '../ContextMenuBuilder'
import type { ContextMenuContext, CoreMenuItem } from '../types'
import { ContextMenuTargetType } from '../types'
import { hitTarget } from './hitTest'

export interface ContextMenuControllerHost {
  stage: Konva.Stage
  ws: Workspace
  onNodeSelect(id: number): void
  onContextMenu(
    ctx: ContextMenuContext,
    evt: PointerEvent,
    menus: CoreMenuItem[],
  ): void
}

export class ContextMenuController {
  _stage: Konva.Stage
  _ws: Workspace
  _onNodeSelect: (id: number) => void
  _onContextMenu: (
    ctx: ContextMenuContext,
    evt: PointerEvent,
    menus: CoreMenuItem[],
  ) => void

  constructor(host: ContextMenuControllerHost) {
    this._stage = host.stage
    this._ws = host.ws
    this._onNodeSelect = host.onNodeSelect
    this._onContextMenu = host.onContextMenu
  }

  handle(e: Konva.KonvaEventObject<PointerEvent>) {
    const ctx = this._resolveTarget(e)
    if (!ctx) return

    if (ctx.type === ContextMenuTargetType.Node) {
      this._onNodeSelect(ctx.id!)
    } else if (ctx.type === ContextMenuTargetType.Group) {
      this._ws.setActiveIds(ActiveType.Group, [ctx.id!])
    }

    this._onContextMenu(ctx, e.evt, buildDefaultContextMenu(ctx, this._ws))
  }

  _resolveTarget(
    e: Konva.KonvaEventObject<PointerEvent>,
  ): ContextMenuContext | null {
    const hit = hitTarget(e.target as Konva.Node)
    if (hit) return { type: hit.type, id: hit.id }

    const ctx: ContextMenuContext = { type: ContextMenuTargetType.Canvas }
    const pos = this._stage.getPointerPosition()
    if (pos) ctx.pos = this._ws.coord.convertScreenCoord(pos)
    return ctx
  }
}
