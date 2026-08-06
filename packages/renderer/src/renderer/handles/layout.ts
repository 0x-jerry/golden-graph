import type { Node, NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { BLOCK_HANDLE_LABEL_ROW, LAYOUT } from '../constants'
import { getHandleFactory } from './index'

/** Measured row heights from live `HandleView`s, keyed by handle. */
const measuredRows = new WeakMap<NodeHandle, number>()

export function setMeasuredRowHeight(handle: NodeHandle, height: number) {
  measuredRows.set(handle, height)
}

export function clearMeasuredRowHeight(handle: NodeHandle) {
  measuredRows.delete(handle)
}

/**
 * Whether a block-layout handle renders its label row. A block handle with
 * neither a name nor a position (layout-only) skips the label row entirely, so
 * its content starts at the top of the row. Inline handles always render a row.
 */
export function hasLabelRow(handle: NodeHandle): boolean {
  if (getHandleFactory(handle.type)?.config?.layout !== 'block') {
    return true
  }
  return handle.name !== '' || handle.position !== HandlePosition.None
}

/**
 * Row height a handle occupies, based on its factory's content layout.
 * Block handles take a label row plus a content row; the content row grows
 * past its static minimum when the rendered content measures taller
 * (wrapping text, images). Falls back to the static minimum when no live
 * handle view has measured itself yet. Label-less, position-less block
 * handles skip the label row.
 */
export function getHandleRowHeight(handle: NodeHandle): number {
  const factory = getHandleFactory(handle.type)
  if (factory?.config?.layout !== 'block') {
    return LAYOUT.HANDLE_ROW_HEIGHT
  }
  const minHeight = factory.config?.minHeight ?? LAYOUT.HANDLE_ROW_HEIGHT
  const staticRow = hasLabelRow(handle)
    ? BLOCK_HANDLE_LABEL_ROW + minHeight
    : minHeight
  return Math.max(staticRow, measuredRows.get(handle) ?? 0)
}

/** Handles in render order: positioned rows first, then layout-only rows. */
function getHandleOrder(node: Node): NodeHandle[] {
  return [
    ...node.handles.filter((h) => h.position !== HandlePosition.None),
    ...node.handles.filter((h) => h.position === HandlePosition.None),
  ]
}

/**
 * Local (node-space) Y of a handle's row center. Inline handles return the
 * center of their `HANDLE_ROW_HEIGHT` row; block handles return the center of
 * their label row, so the joint/label sit where an inline handle would at the
 * same stack position, with the block content extending below. Label-less,
 * position-less block handles have no label row, so their center is the
 * content row center.
 */
export function handleY(node: Node, handle: NodeHandle): number {
  let y = LAYOUT.HEADER_HEIGHT
  for (const h of getHandleOrder(node)) {
    const height = getHandleRowHeight(h)
    if (h === handle) {
      const factory = getHandleFactory(h.type)
      if (factory?.config?.layout === 'block') {
        return hasLabelRow(h) ? y + BLOCK_HANDLE_LABEL_ROW / 2 : y + height / 2
      }
      return y + height / 2
    }
    y += height
  }
  return y
}
