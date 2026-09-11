import type { Node } from '@0x-jerry/golden-graph'

export const LAYOUT = {
  NODE_WIDTH: 200,
  HEADER_HEIGHT: 30,
  HANDLE_ROW_HEIGHT: 28,
  HANDLE_PADDING: 8,
  JOINT_RADIUS: 5,
  GROUP_HEADER_HEIGHT: 50,
  GROUP_PADDING: 40,
} as const

/**
 * Stroke width of the node body outline. Painted as a compile-time value, not a
 * theme token: the header band is inset by it (on top of `headerInset`) so the
 * outline stays visible around the band.
 */
export const NODE_BODY_STROKE_WIDTH = 1

export const NODE_SHAPE = {
  SHADOW: 'shadow',
  BODY: 'body',
  HEADER: 'header',
  NAME: 'name',
  CONTENT: 'content',
  RESIZE: 'resize',
  TAG: 'tag',
  CARET: 'caret',
  HEADER_DIVIDER: 'headerDivider',
  ROW_DIVIDER: 'rowDivider',
} as const

export const ELEMENT_TYPE = {
  NODE: 'node',
  GROUP: 'group',
  JOINT: 'joint',
  EDGE: 'edge',
  HANDLE: 'handle',
} as const

export const ATTR = {
  ELEMENT_ID: 'elementId',
} as const

export const LAYER_NAME = {
  GRID: 'grid',
  GROUPS: 'groups',
  EDGES: 'edges',
  NODES: 'nodes',
} as const

export const DRAG_TYPE = {
  NODE: 'node',
  GROUP: 'group',
  CANVAS: 'canvas',
  SELECTION: 'selection',
  RESIZE: 'resize',
} as const

export const SEL = {
  BODY: '.body',
  HEADER: '.header',
  NAME: '.name',
  CONTENT: '.content',
  RESIZE: '.resize',
} as const

export const NODE_BODY_PADDING = 8

/**
 * Height of a collapsed node: just the header band — the body (background,
 * border) is not rendered while collapsed. Independent of `size.y` — a
 * collapsed node keeps its stored size and restores it on expand.
 */
export function getCollapsedNodeHeight() {
  return LAYOUT.HEADER_HEIGHT
}

/** Chevron size of the expand/collapse caret in the node header. */
export const CARET_SIZE = 10
/** Transparent hit padding around the caret so small clicks still land. */
export const CARET_HIT_PADDING = 4
export const CARET_NAME_GAP = 4
/** Minimum group width/height a user can resize a group down to. */
export const GROUP_MIN_WIDTH = 100
export const GROUP_MIN_HEIGHT = 80

/** Size of the corner resize grip (drawn as a triangle). */
export const RESIZE_HANDLE_SIZE = 12

/**
 * Screen-pixel radius around a joint that auto-targets it during a
 * connection drag, so users don't need to aim exactly at the small joint.
 * Set the renderer's `proximityRadius` to 0 to disable.
 */
export const PROXIMITY_RADIUS = 24
export const BEZIER_MIN_OFFSET = 10
export const BEZIER_MAX_OFFSET = 200
export const EDGE_HIT_STROKE = 20
/** Dash of the in-progress connection preview (real edges use `metrics.edgeDash`). */
export const DASH_PATTERN: number[] = [8, 4]
export const HANDLE_CONTENT_X = LAYOUT.JOINT_RADIUS + 4
export const HANDLE_CONTENT_Y_OFFSET = 8
export const HANDLE_NAME_WIDTH = 60
export const HANDLE_NAME_GAP = 6
/** Stage-container cursor while the pointer hovers a handle joint. */
export const JOINT_CURSOR = 'crosshair'
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 4

/**
 * Zoom step for a given scale — finer steps when zoomed out.
 */
export function getZoomStep(scale: number) {
  return scale > 1 ? 0.05 : scale > 0.1 ? 0.025 : 0.01
}

/**
 * Effective node width. Falls back to the default layout width when the node
 * has no explicit size (`size.x <= 0`).
 */
export function getNodeWidth(node: Node): number {
  return node.size.x > 0 ? node.size.x : LAYOUT.NODE_WIDTH
}
