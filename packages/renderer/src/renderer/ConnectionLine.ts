import Konva from 'konva'
import { clamp } from '@0x-jerry/utils'
import type { NodeHandle, IVec2 } from '@0x-jerry/golden-graph'
import {
  COLORS,
  BEZIER_MIN_OFFSET,
  BEZIER_MAX_OFFSET,
  DASH_PATTERN,
} from './constants'
import { getJointPos } from './EdgeView'

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

  /**
   * Orient the preview the same way the real edge will render: the source
   * handle's curve exits its own face (`isRight`) and the endpoint is reached
   * from the opposite face. X-ordering alone can't decide this — when the
   * output joint sits right of the cursor the curve must bulge outward at
   * both ends, but when it sits left of the cursor it must stay between the
   * two points. The handle carries the orientation, so the caller stays
   * simple and no reversal occurs either way.
   */
  update(source: NodeHandle, end: IVec2) {
    const start = getJointPos(source)
    const dir = source.isRight ? 1 : -1
    const dx = Math.abs(start.x - end.x)
    const offset = clamp(dx / 2, BEZIER_MIN_OFFSET, BEZIER_MAX_OFFSET)

    const cp1x = start.x + dir * offset
    const cp2x = end.x - dir * offset

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