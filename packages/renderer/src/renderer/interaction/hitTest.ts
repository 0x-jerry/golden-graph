import type Konva from 'konva'
import { ATTR, ELEMENT_TYPE } from '../constants'
import { ContextMenuTargetType } from '../types'

export interface HitTarget {
  type: ContextMenuTargetType.Node | ContextMenuTargetType.Group
  id: number
}

/** Resolve the node/group an element belongs to via the element-id attributes. */
export function hitTarget(target: Konva.Node): HitTarget | null {
  const nodeGroup = target.findAncestor(
    (n: Konva.Node) => n.name() === ELEMENT_TYPE.NODE,
  ) as Konva.Group | undefined

  if (nodeGroup) {
    const nodeId = nodeGroup.getAttr(ATTR.ELEMENT_ID)
    if (nodeId) return { type: ContextMenuTargetType.Node, id: nodeId as number }
  }

  const groupGroup = target.findAncestor(
    (n: Konva.Node) => n.name() === ELEMENT_TYPE.GROUP,
  ) as Konva.Group | undefined

  if (groupGroup) {
    const groupId = Number(groupGroup.getAttr(ATTR.ELEMENT_ID))
    if (groupId) return { type: ContextMenuTargetType.Group, id: groupId }
  }

  return null
}

export function getJointInfo(
  target: Konva.Node,
): { nodeId: number; handleKey: string } | null {
  if (target.name() !== ELEMENT_TYPE.JOINT) return null

  const handleKey = target
    .findAncestor((n: Konva.Node) => n.name() === ELEMENT_TYPE.HANDLE)
    ?.getAttr(ATTR.ELEMENT_ID)

  const nodeId = target
    .findAncestor((n: Konva.Node) => n.name() === ELEMENT_TYPE.NODE)
    ?.getAttr(ATTR.ELEMENT_ID)

  if (handleKey == null || nodeId == null) return null

  return {
    nodeId: nodeId as number,
    handleKey: handleKey as string,
  }
}
