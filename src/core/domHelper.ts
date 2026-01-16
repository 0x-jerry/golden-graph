import type { Optional } from '@0x-jerry/utils'
import { RectBox } from '../utils/RectBox'
import type { Node } from './Node'
import type { NodeHandle } from './NodeHandle'

export function getWorkspaceDom(workspaceId: string) {
  return document.querySelector(
    `[workspace-id="${workspaceId}"]`,
  ) as Optional<HTMLElement>
}

export function getNodeDom(workspaceId: string, nodeId: number) {
  return getWorkspaceDom(workspaceId)?.querySelector(
    `[node-id="${nodeId}"]`,
  ) as Optional<HTMLElement>
}

export function getNodeHandleDom(
  workspaceId: string,
  nodeId: number,
  handleKey: string,
) {
  return getNodeDom(workspaceId, nodeId)?.querySelector(
    `[handle-key="${handleKey}"]`,
  ) as Optional<HTMLElement>
}

export function getNodesBounding(nodes: Node[]) {
  let updated = false

  const rect = new RectBox()

  for (const node of nodes) {
    const r = getNodeDom(node.workspace.id, node.id)

    if (!r) {
      throw new Error(`Can not find node dom by id: ${node.id}`)
    }

    const left = node.pos.x
    const top = node.pos.y
    const right = left + r.clientWidth
    const bottom = top + r.clientHeight

    if (updated) {
      rect.left = Math.min(rect.left, left)
      rect.top = Math.min(rect.top, top)
      rect.right = Math.max(rect.right, right)
      rect.bottom = Math.max(rect.bottom, bottom)
    } else {
      rect.left = left
      rect.top = top
      rect.right = right
      rect.bottom = bottom

      updated = true
    }
  }

  return rect
}

/**
 * Get Handle joint dom element
 * @param handle
 * @returns
 */
export function getHandleJointDom(handle: NodeHandle) {
  const nodeId = handle.node.id
  const wsId = handle.node.workspace.id

  const el = getNodeHandleDom(wsId, nodeId, handle.key)
  return el?.querySelector(`[role="handle-joint"]`) as Optional<HTMLElement>
}

/**
 * Absolute position
 */
export function getHandleJointDomPosition(handle: NodeHandle) {
  const dom = getHandleJointDom(handle)
  if (!dom) {
    throw new Error('Can not find joint dom element!')
  }

  const pos = {
    x: handle.node.pos.x + dom.offsetLeft + dom.clientWidth / 2,
    y: handle.node.pos.y + dom.offsetTop + dom.clientHeight / 2,
  }

  return pos
}
