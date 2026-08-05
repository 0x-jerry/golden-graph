import Konva from 'konva'
import type { Edge, NodeHandle } from '@0x-jerry/golden-graph'
import {
  COLORS,
  BEZIER_MIN_OFFSET,
  BEZIER_MAX_OFFSET,
  EDGE_HIT_STROKE,
  ELEMENT_TYPE,
  ATTR,
  getNodeWidth,
} from './constants'
import { handleY } from './handles/layout'
import { EntityView } from './EntityView'

const CLOSE_SIZE = 12

export class EdgeView extends EntityView<Edge> {
  _line: Konva.Line
  _closeBtn: Konva.Group

  constructor(edge: Edge) {
    const group = new Konva.Group({
      name: ELEMENT_TYPE.EDGE,
      [ATTR.ELEMENT_ID]: edge.id,
    })

    const { points, mid } = computeEdgeGeometry(edge)

    const line = new Konva.Line({
      points,
      bezier: true,
      stroke: COLORS.EDGE,
      strokeWidth: COLORS.EDGE_WIDTH,
      hitStrokeWidth: EDGE_HIT_STROKE,
      fill: undefined,
      name: 'edge-line',
    })
    group.add(line)

    const closeBtn = createCloseButton()
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
    this._line = line
    this._closeBtn = closeBtn
  }

  get closeButton(): Konva.Group {
    return this._closeBtn
  }

  update(): void {
    const { points, mid } = computeEdgeGeometry(this.entity)
    this._line.points(points)
    this._closeBtn.position(mid)
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

  return { points, mid }
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
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  }
}

function createCloseButton(): Konva.Group {
  const group = new Konva.Group({
    name: 'edge-close',
    visible: false,
  })

  const circle = new Konva.Rect({
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    offsetX: CLOSE_SIZE / 2,
    offsetY: CLOSE_SIZE / 2,
    fill: COLORS.BG,
    stroke: COLORS.EDGE,
    strokeWidth: 1,
    cornerRadius: 2,
  })
  group.add(circle)

  const line1 = new Konva.Line({
    points: [-3, -3, 3, 3],
    stroke: COLORS.EDGE,
    strokeWidth: 1.5,
    lineCap: 'round',
  })
  const line2 = new Konva.Line({
    points: [3, -3, -3, 3],
    stroke: COLORS.EDGE,
    strokeWidth: 1.5,
    lineCap: 'round',
  })
  group.add(line1, line2)

  return group
}