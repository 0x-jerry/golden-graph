import Konva from 'konva'
import type { Edge, NodeHandle } from '@0x-jerry/golden-graph'
import {
  BEZIER_MIN_OFFSET,
  BEZIER_MAX_OFFSET,
  EDGE_HIT_STROKE,
  ELEMENT_TYPE,
  ATTR,
  getNodeWidth,
} from './constants'
import { handleY } from './handles/layout'
import { jointColor } from './joint'
import { EntityView } from './EntityView'
import { getHandleFactory } from './handles'
import { DEFAULT_THEME } from '../theme'
import type { GraphTheme } from '../theme'

const CLOSE_SIZE = 12

export class EdgeView extends EntityView<Edge> {
  _line: Konva.Line
  _closeBtn: Konva.Group
  /** Active theme, re-applied on hot-swap via `applyTheme`. */
  _theme: GraphTheme

  constructor(edge: Edge, theme: GraphTheme = DEFAULT_THEME) {
    const group = new Konva.Group({
      name: ELEMENT_TYPE.EDGE,
      [ATTR.ELEMENT_ID]: edge.id,
    })

    const { points, mid, source } = computeEdgeGeometry(edge)

    const line = new Konva.Line({
      points,
      bezier: true,
      stroke: edgeStroke(source, theme),
      strokeWidth: theme.metrics.edgeWidth,
      hitStrokeWidth: EDGE_HIT_STROKE,
      fill: undefined,
      name: 'edge-line',
    })
    group.add(line)

    const closeBtn = createCloseButton(line.stroke() as string, theme)
    closeBtn.position(mid)
    group.add(closeBtn)

    line.on('mouseenter', () => {
      closeBtn.visible(true)
      closeBtn.getLayer()?.batchDraw()
    })
    line.on('mouseleave', () => {
      closeBtn.visible(false)
      closeBtn.getLayer()?.batchDraw()
    })
    closeBtn.on('mouseenter', () => {
      closeBtn.visible(true)
    })

    super(edge, group)
    this._theme = theme
    this._line = line
    this._closeBtn = closeBtn
  }

  get closeButton(): Konva.Group {
    return this._closeBtn
  }

  update(): void {
    const { points, mid, source } = computeEdgeGeometry(this.entity)
    this._line.points(points)
    this._line.stroke(edgeStroke(source, this._theme))
    this._closeBtn.position(mid)
  }

  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    const { source } = computeEdgeGeometry(this.entity)
    const stroke = edgeStroke(source, theme)
    this._line.stroke(stroke)
    this._line.strokeWidth(theme.metrics.edgeWidth)
    applyCloseButtonTheme(this._closeBtn, stroke, theme)
  }
}

export function getJointPos(handle: NodeHandle): { x: number; y: number } {
  const y = handle.node.pos.y + handleY(handle.node, handle)

  if (handle.isRight) {
    return { x: handle.node.pos.x + getNodeWidth(handle.node), y }
  }
  return { x: handle.node.pos.x, y }
}

export function bezierOffset(
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
): { handleOffset: number } {
  const dx = Math.abs(startPos.x - endPos.x)
  const handleOffset = Math.max(
    BEZIER_MIN_OFFSET,
    Math.min(dx / 2, BEZIER_MAX_OFFSET),
  )
  return { handleOffset }
}

function computeEdgeGeometry(edge: Edge) {
  let startHandle = edge.start
  let endHandle = edge.end

  if (edge.start.isRight) {
    startHandle = edge.end
    endHandle = edge.start
  }

  const startPos = getJointPos(startHandle)
  const endPos = getJointPos(endHandle)

  const { handleOffset } = bezierOffset(startPos, endPos)

  const p0 = startPos
  const p1 = { x: startPos.x - handleOffset, y: startPos.y }
  const p2 = { x: endPos.x + handleOffset, y: endPos.y }
  const p3 = endPos

  const points = [p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]
  const mid = bezierMidpoint(p0, p1, p2, p3)

  // `startHandle` is the visual (leftmost) departure point, not the data
  // source: data always flows out of the right (output) handle, regardless of
  // which endpoint `connect()` was called with.
  const source = edge.start.isRight ? edge.start : edge.end

  return { points, mid, source }
}

/** Edge stroke follows the source port's joint color, at the classic alpha. */
function edgeStroke(handle: NodeHandle, theme: GraphTheme): string {
  const color =
    getHandleFactory(handle.type)?.config?.joint?.color ??
    theme.colors.jointDefault
  return jointColor({ color, shape: 'circle' }, 0.5)
}

function bezierMidpoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): { x: number; y: number } {
  const t = 0.5
  const mt = 1 - t
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  }
}

function createCloseButton(stroke: string, theme: GraphTheme): Konva.Group {
  const group = new Konva.Group({
    name: 'edge-close',
    visible: false,
  })

  const circle = new Konva.Rect({
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    offsetX: CLOSE_SIZE / 2,
    offsetY: CLOSE_SIZE / 2,
    fill: theme.colors.bg,
    stroke,
    strokeWidth: 1,
    cornerRadius: 2,
  })
  group.add(circle)

  const line1 = new Konva.Line({
    points: [-3, -3, 3, 3],
    stroke,
    strokeWidth: 1.5,
    lineCap: 'round',
  })
  const line2 = new Konva.Line({
    points: [3, -3, -3, 3],
    stroke,
    strokeWidth: 1.5,
    lineCap: 'round',
  })
  group.add(line1, line2)

  return group
}

function applyCloseButtonTheme(
  group: Konva.Group,
  stroke: string,
  theme: GraphTheme,
): void {
  const circle = group.getChildren()[0] as Konva.Rect
  circle.fill(theme.colors.bg)
  circle.stroke(stroke)
  for (const line of group.getChildren().slice(1) as Konva.Line[]) {
    line.stroke(stroke)
  }
}
