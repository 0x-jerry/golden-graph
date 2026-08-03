import Konva from 'konva'
import { clamp } from '@0x-jerry/utils'
import type { IVec2 } from '@0x-jerry/golden-graph'
import {
  COLORS,
  BEZIER_MIN_OFFSET,
  BEZIER_MAX_OFFSET,
  DASH_PATTERN,
} from './constants'

export class ConnectionLine extends Konva.Line {
  constructor() {
    super({
      points: [0, 0, 0, 0, 0, 0, 0, 0],
      bezier: true,
      stroke: COLORS.EDGE,
      strokeWidth: COLORS.EDGE_WIDTH,
      fill: undefined,
      listening: false,
      dash: DASH_PATTERN,
    })
  }

  update(start: IVec2, end: IVec2) {
    const dx = Math.abs(start.x - end.x)
    const offset = clamp(dx / 2, BEZIER_MIN_OFFSET, BEZIER_MAX_OFFSET)

    const cp1x = start.x <= end.x ? start.x + offset : start.x - offset
    const cp2x = start.x <= end.x ? end.x - offset : end.x + offset

    this.points([
      start.x,
      start.y,
      cp1x,
      start.y,
      cp2x,
      end.y,
      end.x,
      end.y,
    ])
  }
}