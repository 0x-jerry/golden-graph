import type { Node, NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { BLOCK_HANDLE_ROW_HEIGHT, LAYOUT } from '../constants'
import { getHandleModule } from './index'

/**
 * Row height a handle occupies, based on its module's content layout.
 * Block handles take two rows (label + full-width content).
 */
export function getHandleRowHeight(handle: NodeHandle): number {
  return getHandleModule(handle.type)?.config?.layout === 'block'
    ? BLOCK_HANDLE_ROW_HEIGHT
    : LAYOUT.HANDLE_ROW_HEIGHT
}

/** Handles in render order: positioned rows first, then layout-only rows. */
function getHandleOrder(node: Node): NodeHandle[] {
  return [
    ...node.handles.filter((h) => h.position !== HandlePosition.None),
    ...node.handles.filter((h) => h.position === HandlePosition.None),
  ]
}

/** Local (node-space) Y of a handle's row center. */
export function handleY(node: Node, handle: NodeHandle): number {
  let y = LAYOUT.HEADER_HEIGHT
  for (const h of getHandleOrder(node)) {
    const height = getHandleRowHeight(h)
    if (h === handle) {
      return y + height / 2
    }
    y += height
  }
  return y
}
