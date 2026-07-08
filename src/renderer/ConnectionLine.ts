import Konva from 'konva'
import { clamp } from '@0x-jerry/utils'
import type { IVec2 } from '../core'
import { COLORS } from './types'

export class ConnectionLine {
  private _line: Konva.Line | null = null
  private _layer: Konva.Layer

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

    const offset = clamp(Math.abs(start.x - end.x) / 2, 10, 200)

    this._line.points([
      start.x, start.y,
      start.x - offset, start.y,
      end.x + offset, end.y,
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
