import type { NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import {
  LAYOUT,
  HANDLE_CONTENT_X,
  HANDLE_NAME_WIDTH,
  HANDLE_NAME_GAP,
  getNodeWidth,
} from '../constants'
import { getHandleFactory } from './index'
import { isBlockHandle } from './layout'

/**
 * Whether a handle's label owns the full row width: block handles, whose
 * label has its own row, and handles with no content widget, where nothing
 * else competes for the row.
 */
function usesFullWidthLabel(handle: NodeHandle): boolean {
  return isBlockHandle(handle) || !getHandleFactory(handle.type)?.create
}

/**
 * Label box width. Unnamed handles auto-size (and render nothing). Full-width
 * labels span the node's inner width; the rest keep the fixed column that
 * aligns handle contents across rows.
 */
export function labelWidth(handle: NodeHandle): number | undefined {
  if (handle.name === '') {
    return undefined
  }
  return usesFullWidthLabel(handle)
    ? Math.max(0, getNodeWidth(handle.node) - LAYOUT.HANDLE_PADDING * 2)
    : HANDLE_NAME_WIDTH
}

/** Local X of a handle label's box. */
export function labelX(handle: NodeHandle): number {
  if (usesFullWidthLabel(handle)) {
    return LAYOUT.HANDLE_PADDING
  }
  if (handle.position === HandlePosition.Right) {
    return getNodeWidth(handle.node) - HANDLE_CONTENT_X - HANDLE_NAME_WIDTH
  }
  return handle.position === HandlePosition.Left
    ? HANDLE_CONTENT_X
    : LAYOUT.HANDLE_PADDING
}

/**
 * Local X of a handle content group's origin, before the right-positioned
 * offset applied at layout time. Block content spans the node width; inline
 * content sits beside the label's name column.
 */
export function contentX(handle: NodeHandle, nameWidth: number): number {
  if (isBlockHandle(handle)) {
    if (handle.position === HandlePosition.Right) {
      return getNodeWidth(handle.node) - HANDLE_CONTENT_X
    }
    return handle.position === HandlePosition.Left
      ? HANDLE_CONTENT_X
      : LAYOUT.HANDLE_PADDING
  }
  const nameGap = nameWidth > 0 ? HANDLE_NAME_GAP : 0
  if (handle.position === HandlePosition.Right) {
    return getNodeWidth(handle.node) - HANDLE_CONTENT_X - nameWidth - nameGap
  }
  if (handle.position === HandlePosition.Left) {
    return HANDLE_CONTENT_X + nameWidth + nameGap
  }
  return LAYOUT.HANDLE_PADDING + nameWidth + nameGap
}
