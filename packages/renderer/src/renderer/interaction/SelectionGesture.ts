import Konva from 'konva'
import type { IVec2 } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import {
  COLORS,
  LAYER_NAME,
  getNodeHeight,
  getNodeWidth,
} from '../constants'
import type { GestureContext } from './types'

export class SelectionGesture {
  _started = false
  _x1 = 0
  _y1 = 0
  _rect: Konva.Rect | null = null
  _ctx: GestureContext

  constructor(_ctx: GestureContext) {
    this._ctx = _ctx
  }

  start() {
    const pos = this._ctx.stage.getPointerPosition()
    if (!pos) return

    this._started = true
    this._x1 = pos.x
    this._y1 = pos.y

    if (!this._rect) {
      this._rect = new Konva.Rect({
        fill: COLORS.SELECTION_FILL,
        stroke: COLORS.SELECTION_BORDER,
        strokeWidth: 1,
        listening: false,
        visible: false,
      })
      this._render()
    }
  }

  move(screenPos: IVec2) {
    if (!this._rect) return

    const x = Math.min(this._x1, screenPos.x)
    const y = Math.min(this._y1, screenPos.y)
    const w = Math.abs(this._x1 - screenPos.x)
    const h = Math.abs(this._y1 - screenPos.y)

    // Convert from screen coords to stage-local coords so the rect renders
    // at the correct position when the stage has a transform applied.
    const stage = this._ctx.stage
    this._rect.x((x - stage.x()) / stage.scaleX())
    this._rect.y((y - stage.y()) / stage.scaleY())
    this._rect.width(w / stage.scaleX())
    this._rect.height(h / stage.scaleY())
    this._rect.visible(true)
    this._render()
  }

  end() {
    if (!this._rect || !this._started) return

    this._started = false
    this._rect.visible(false)
    this._render()

    const rect = this._rect
    // After the fix in _handleSelectionDrag, rect position is in stage-local
    // coords which equal convertScreenCoord(screenPos), i.e. workspace coords.
    const tl = { x: rect.x(), y: rect.y() }
    const br = {
      x: rect.x() + rect.width(),
      y: rect.y() + rect.height(),
    }

    const ids: number[] = []
    for (const node of this._ctx.ws.nodes) {
      if (
        node.pos.x >= tl.x &&
        node.pos.y >= tl.y &&
        node.pos.x + getNodeWidth(node) <= br.x &&
        node.pos.y + getNodeHeight(node) <= br.y
      ) {
        ids.push(node.id)
      }
    }

    this._ctx.ws.setActiveIds(ActiveType.Node, ids)
  }

  _render() {
    if (this._rect) this._ctx.renderOverlay(this._rect, LAYER_NAME.NODES)
  }
}
