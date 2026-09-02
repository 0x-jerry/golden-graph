import Konva from 'konva'
import type { IVec2 } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import {
  LAYER_NAME,
  getNodeWidth,
} from '../constants'
import { getNodeHeight } from '../NodeView'
import type { GestureContext, IGesture } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

export class SelectionGesture implements IGesture {
  _started = false
  _x1 = 0
  _y1 = 0
  _rect: Konva.Rect | null = null
  _ctx: GestureContext
  /** Active theme used to tint the selection rect. */
  _theme: GraphTheme

  constructor(_ctx: GestureContext, theme: GraphTheme = DEFAULT_THEME) {
    this._ctx = _ctx
    this._theme = theme
  }

  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    this._rect?.fill(theme.colors.selectionFill)
    this._rect?.stroke(theme.colors.selectionBorder)
  }

  start() {
    const pos = this._ctx.stage.getPointerPosition()
    if (!pos) return

    this._started = true
    this._x1 = pos.x
    this._y1 = pos.y

    if (!this._rect) {
      this._rect = new Konva.Rect({
        fill: this._theme.colors.selectionFill,
        stroke: this._theme.colors.selectionBorder,
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
    // The rect is in stage-local coords, which equal workspace coords
    // (convertScreenCoord).
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
