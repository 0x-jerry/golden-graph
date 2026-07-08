import Konva from 'konva'
import type { Edge, NodeHandle } from '../core'
import { HandlePosition } from '../core'
import {
  COLORS,
  LAYOUT,
  NAME,
  BEZIER_MIN_OFFSET,
  BEZIER_MAX_OFFSET,
  EDGE_HIT_STROKE,
} from './constants'

function getJointPos(handle: NodeHandle): { x: number; y: number } {
  const handles = handle.node.handles.filter(
    (h: NodeHandle) => h.position !== HandlePosition.None,
  )
  const index = handles.indexOf(handle)
  const y =
    handle.node.pos.y +
    LAYOUT.HEADER_HEIGHT +
    index * LAYOUT.HANDLE_ROW_HEIGHT +
    LAYOUT.HANDLE_ROW_HEIGHT / 2

  if (handle.isRight) {
    return { x: handle.node.pos.x + LAYOUT.NODE_WIDTH, y }
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

export function createEdge(edge: Edge): Konva.Line {
  let startHandle = edge.start
  let endHandle = edge.end

  if (edge.start.isRight) {
    startHandle = edge.end
    endHandle = edge.start
  }

  const startPos = getJointPos(startHandle)
  const endPos = getJointPos(endHandle)

  const { handleOffset } = bezierOffset(startPos, endPos)

  const points = [
    startPos.x,
    startPos.y,
    startPos.x - handleOffset,
    startPos.y,
    endPos.x + handleOffset,
    endPos.y,
    endPos.x,
    endPos.y,
  ]

  const line = new Konva.Line({
    points,
    bezier: true,
    stroke: COLORS.EDGE,
    strokeWidth: COLORS.EDGE_WIDTH,
    hitStrokeWidth: EDGE_HIT_STROKE,
    fill: undefined,
    name: NAME.EDGE(edge.id),
  })

  return line
}

export function destroyEdge(line: Konva.Line): void {
  line.destroy()
}
