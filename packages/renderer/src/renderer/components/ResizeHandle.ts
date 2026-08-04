import Konva from 'konva'
import { COLORS, NODE_SHAPE, RESIZE_HANDLE_SIZE } from '../constants'

/**
 * Corner resize grip (triangle) with an enlarged hit area for easy grabbing.
 *
 * Konva v10 no longer applies the shape `cursor` config, so the resize cursor
 * is set on the stage container manually while the pointer hovers the grip.
 */
export class ResizeHandle extends Konva.Group {
  _hit: Konva.Rect

  constructor() {
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

    hit.on('mouseover pointerover', this._setResizeCursor)
    hit.on('mouseout pointerout', this._resetCursor)
    // Deselecting (hiding the grip) while the pointer rests on it must also
    // release the cursor — no mouseout fires without pointer movement.
    this.on('visibleChange', this._onVisibleChange)

    this.add(hit)

    const triangle = new Konva.Line({
      points: [0, size, size, size, size, 0],
      closed: true,
      fill: COLORS.ACCENT,
      stroke: COLORS.BG,
      strokeWidth: 1,
      listening: false,
    })
    this.add(triangle)
  }

  _setResizeCursor = () => {
    const stage = this._hit.getStage()
    if (stage) stage.content.style.cursor = 'nwse-resize'
  }

  _resetCursor = () => {
    const stage = this._hit.getStage()
    if (stage) stage.content.style.cursor = ''
  }

  _onVisibleChange = () => {
    if (!this.visible()) this._resetCursor()
  }

  destroy(): this {
    // Release the cursor when the grip is torn down. Konva fires no destroy
    // event, so a `mouseout` would never reset the cursor if the pointer rests
    // on the grip while its entity is deleted. Must run before `super.destroy()`
    // detaches the grip from the stage.
    this._resetCursor()
    return super.destroy()
  }
}
