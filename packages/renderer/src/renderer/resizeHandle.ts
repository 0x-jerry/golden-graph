import Konva from 'konva'
import { COLORS, NODE_SHAPE, RESIZE_HANDLE_SIZE } from './constants'

/** Corner resize grip (triangle), hit area enlarged for easy grabbing. */
export function renderResizeHandle(): Konva.Group {
  const size = RESIZE_HANDLE_SIZE
  const grip = new Konva.Group({
    name: NODE_SHAPE.RESIZE,
    // Shown only while the entity is selected (views toggle visibility).
    visible: false,
  })

  // Generous invisible hit area so the tiny triangle is easy to grab.
  const hit = new Konva.Rect({
    x: -10,
    y: -10,
    width: size + 20,
    height: size + 20,
    fill: 'transparent',
    cursor: 'nwse-resize',
    name: NODE_SHAPE.RESIZE,
  })
  grip.add(hit)

  const triangle = new Konva.Line({
    points: [0, size, size, size, size, 0],
    closed: true,
    fill: COLORS.ACCENT,
    stroke: COLORS.BG,
    strokeWidth: 1,
    listening: false,
  })
  grip.add(triangle)

  return grip
}
