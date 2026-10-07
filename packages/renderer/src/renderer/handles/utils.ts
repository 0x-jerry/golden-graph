import type { NodeHandle } from '@0x-jerry/golden-graph'
import {
  LAYOUT,
  HANDLE_CONTENT_X,
  HANDLE_NAME_WIDTH,
  HANDLE_NAME_GAP,
  getNodeWidth,
} from '../constants'

export function availableWidth(handle: NodeHandle): number {
  const nameWidth = handle.name ? HANDLE_NAME_WIDTH : 0
  const nameGap = nameWidth > 0 ? HANDLE_NAME_GAP : 0
  return getNodeWidth(handle.node) - HANDLE_CONTENT_X - nameWidth - nameGap - LAYOUT.HANDLE_PADDING
}

/** Content width of a block-layout handle: the node's inner width. */
export function blockContentWidth(handle: NodeHandle): number {
  return getNodeWidth(handle.node) - LAYOUT.HANDLE_PADDING * 2
}
