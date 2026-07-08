import Konva from 'konva'
import { clamp } from '@0x-jerry/utils'
import type { IVec2 } from '../core'
import { COLORS } from './types'

export class ConnectionLine {
  _line: Konva.Line | null = null
  _layer: Konva.Layer

  constructor(layer: Konva.Layer) {
    this._layer = layer
  }

  show(start: IVec2, end: IVec2) {
    if (!this._line) {
      this._line = new Konva.Line({
        points: [0, 0, 0, 0, 0, 0, 0, 0],
        bezier: true,
        stroke: COLORS.EDGE,
        strokeWidth: COLORS.EDGE_WIDTH,
        fill: undefined,
        listening: false,
        dash: [8, 4],
      })
      this._layer.add(this._line)
    }
    this.update(start, end)
    this._line.visible(true)
    this._layer.batchDraw()
  }

  update(start: IVec2, end: IVec2) {
    if (!this._line) return

    const dx = Math.abs(start.x - end.x)
    const offset = clamp(dx / 2, 10, 200)

    const cp1x = start.x <= end.x ? start.x + offset : start.x - offset
    const cp2x = start.x <= end.x ? end.x - offset : end.x + offset

    this._line.points([
      start.x, start.y,
      cp1x, start.y,
      cp2x, end.y,
      end.x, end.y,
    ])
    this._layer.batchDraw()
  }

  hide() {
    if (this._line) {
      this._line.visible(false)
      this._layer.batchDraw()
    }
  }

  destroy() {
    if (this._line) {
      this._line.destroy()
      this._line = null
    }
  }
}
