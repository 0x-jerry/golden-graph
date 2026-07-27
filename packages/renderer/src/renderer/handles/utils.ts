import type { NodeHandle } from '@0x-jerry/golden-graph'
import {
  LAYOUT,
  HANDLE_CONTENT_X,
  HANDLE_NAME_WIDTH,
  HANDLE_NAME_GAP,
} from '../constants'

export function availableWidth(handle: NodeHandle): number {
  const nameWidth = handle.name ? HANDLE_NAME_WIDTH : 0
  const nameGap = nameWidth > 0 ? HANDLE_NAME_GAP : 0
  return LAYOUT.NODE_WIDTH - HANDLE_CONTENT_X - nameWidth - nameGap - LAYOUT.HANDLE_PADDING
}
