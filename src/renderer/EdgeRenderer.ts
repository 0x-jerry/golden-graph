import Konva from 'konva'
import type { Edge, NodeHandle } from '../core'
import { HandlePosition } from '../core'
import { COLORS, LAYOUT } from './types'

function getJointPos(
  handle: NodeHandle,
): { x: number; y: number } {
  const handles = handle.node.handles.filter((h: NodeHandle) => h.position !== HandlePosition.None)
  const index = handles.indexOf(handle)
  const y = handle.node.pos.y + LAYOUT.HEADER_HEIGHT + index * LAYOUT.HANDLE_ROW_HEIGHT + LAYOUT.HANDLE_ROW_HEIGHT / 2

  if (handle.isRight) {
    return { x: handle.node.pos.x + LAYOUT.NODE_WIDTH, y }
  }
  return { x: handle.node.pos.x, y }
}

export function computeBezierPoints(
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
): number[] {
  const dx = Math.abs(startPos.x - endPos.x)
  const handleOffset = Math.max(10, Math.min(dx / 2, 200))

  return [
    startPos.x, startPos.y,
    startPos.x + handleOffset, startPos.y,
    endPos.x - handleOffset, endPos.y,
    endPos.x, endPos.y,
  ]
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

  const points = computeBezierPoints(startPos, endPos)

  const line = new Konva.Line({
    points,
    bezier: true,
    stroke: COLORS.EDGE,
    strokeWidth: COLORS.EDGE_WIDTH,
    hitStrokeWidth: 20,
    fill: undefined,
    name: `edge-${edge.id}`,
  })

  return line
}

export function destroyEdge(line: Konva.Line): void {
  line.destroy()
}
