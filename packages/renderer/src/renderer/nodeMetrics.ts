import type { Node } from '@0x-jerry/golden-graph'
import { LAYOUT, NODE_BODY_PADDING, getCollapsedNodeHeight } from './constants'
import { getHandleRowHeight } from './handles/layout'

/**
 * Content-driven node height (header + handle rows + padding), using measured
 * block row heights when live handle views exist.
 */
function getNodeContentHeight(node: Node): number {
  let contentHeight = LAYOUT.HEADER_HEIGHT + NODE_BODY_PADDING
  for (const handle of node.handles) {
    contentHeight += getHandleRowHeight(handle)
  }
  return contentHeight
}

/**
 * Effective node height. A manually sized node (`size.y > 0`) keeps exactly
 * its size — block content that doesn't fit is clipped by the node body
 * instead of expanding it. Auto-height nodes render at their content-driven
 * height, which is bounded because block rows never exceed their allocated
 * space.
 */
export function getNodeHeight(node: Node): number {
  if (node.collapsed) {
    return getCollapsedNodeHeight()
  }
  if (node.size.y > 0) {
    return node.size.y
  }
  return getNodeContentHeight(node)
}
