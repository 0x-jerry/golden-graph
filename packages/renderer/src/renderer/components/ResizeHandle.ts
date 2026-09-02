import Konva from 'konva'
import { NODE_SHAPE, RESIZE_HANDLE_SIZE } from '../constants'
import { registerStageCursor } from '../cursor'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

/**
 * Corner resize grip (triangle) with an enlarged hit area for easy grabbing.
 */
export class ResizeHandle extends Konva.Group {
  _hit: Konva.Rect
  _triangle: Konva.Line

  constructor(theme: GraphTheme = DEFAULT_THEME) {
    const size = RESIZE_HANDLE_SIZE

    super({
      name: NODE_SHAPE.RESIZE,
      // Shown only while the entity is selected (views toggle visibility).
      visible: false,
    })

    // Generous invisible hit area so the tiny triangle is easy to grab.
    const padding = 2
    const hit = new Konva.Rect({
      x: -padding,
      y: -padding,
      width: size + padding * 2,
      height: size + padding * 2,
      fill: 'transparent',
      name: NODE_SHAPE.RESIZE,
    })
    this._hit = hit

    registerStageCursor(hit, 'nwse-resize')
    this.add(hit)

    const triangle = new Konva.Line({
      points: [0, size, size, size, size, 0],
      closed: true,
      fill: theme.colors.accent,
      stroke: theme.colors.bg,
      strokeWidth: 1,
      listening: false,
    })
    this.add(triangle)
    this._triangle = triangle
  }

  applyTheme(theme: GraphTheme): void {
    this._triangle.fill(theme.colors.accent)
    this._triangle.stroke(theme.colors.bg)
  }
}
