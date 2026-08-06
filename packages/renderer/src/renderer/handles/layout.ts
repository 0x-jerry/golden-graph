import type { Node, NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { BLOCK_HANDLE_LABEL_ROW, LAYOUT } from '../constants'
import { getHandleModule } from './index'

/** Measured row heights from live `HandleView`s, keyed by handle. */
const measuredRows = new WeakMap<NodeHandle, number>()

export function setMeasuredRowHeight(handle: NodeHandle, height: number) {
  measuredRows.set(handle, height)
}

export function clearMeasuredRowHeight(handle: NodeHandle) {
  measuredRows.delete(handle)
}

/**
 * Row height a handle occupies, based on its module's content layout.
 * Block handles take a label row plus a content row; the content row grows
 * past its static minimum when the rendered content measures taller
 * (wrapping text, images). Falls back to the static minimum when no live
 * handle view has measured itself yet.
 */
export function getHandleRowHeight(handle: NodeHandle): number {
  const module = getHandleModule(handle.type)
  if (module?.config?.layout !== 'block') {
    return LAYOUT.HANDLE_ROW_HEIGHT
  }
  const minHeight = module.config.minHeight ?? LAYOUT.HANDLE_ROW_HEIGHT
  const staticRow = BLOCK_HANDLE_LABEL_ROW + minHeight
  return Math.max(staticRow, measuredRows.get(handle) ?? 0)
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
