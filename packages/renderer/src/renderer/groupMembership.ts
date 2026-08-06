import type { Group, Node, Workspace } from '@0x-jerry/golden-graph'
import { getNodeWidth } from './constants'
import { getNodeHeight } from './NodeView'

interface IRect {
  left: number
  top: number
  right: number
  bottom: number
}

function nodeRect(node: Node): IRect {
  return {
    left: node.pos.x,
    top: node.pos.y,
    right: node.pos.x + getNodeWidth(node),
    bottom: node.pos.y + getNodeHeight(node),
  }
}

function groupRect(group: Group): IRect {
  return {
    left: group.pos.x,
    top: group.pos.y,
    right: group.pos.x + group.size.x,
    bottom: group.pos.y + group.size.y,
  }
}

function overlaps(a: IRect, b: IRect) {
  return (
    a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
  )
}

/**
 * Geometry-driven group membership. A node becomes a member whenever its rect
 * overlaps the group's area, and is disconnected once it no longer overlaps.
 *
 * Emits `group:changed` only when a group's membership actually changes.
 */
export function syncGroupMembership(ws: Workspace) {
  const groups = ws.groups
  if (!groups.length) return

  const nodeIds = new Set<number>()
  for (const node of ws.nodes) nodeIds.add(node.id)

  for (const group of groups) {
    const rect = groupRect(group)
    const members = new Set(group.nodes)

    for (const node of ws.nodes) {
      if (overlaps(nodeRect(node), rect)) {
        members.add(node.id)
      } else {
        members.delete(node.id)
      }
    }

    const next: number[] = []
    for (const id of members) {
      if (nodeIds.has(id)) next.push(id)
    }

    if (!sameMembers(group.nodes, next)) {
      group.nodes.splice(0)
      group.nodes.push(...next)
      ws.events.emit('group:changed', group)
    }
  }
}

function sameMembers(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
