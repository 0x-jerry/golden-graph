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

export const COLORS = {
  BG: '#ffffff',
  BORDER: '#cccccc',
  HEADER_BG: '#eeeeee',
  TEXT_PRIMARY: '#333333',
  TEXT_MUTED: '#666666',
  ACCENT: '#007acc',
  ACCENT_SOFT: 'rgba(13, 200, 13, 0.4)',
  EDGE: '#ef4646',
  EDGE_WIDTH: 3,
  JOINT_DEFAULT: '#000000',
  /** Joint fill while a connection drag is hovering a compatible handle. */
  JOINT_HIGHLIGHT: '#16a34a',
  GROUP_BG: 'rgba(213, 213, 213, 0.67)',
  GROUP_BORDER: '#b0b0b0',
  GRID_COLOR: '#cccccc',
  GROUP_HEADER_BG: 'rgba(0, 0, 0, 0.1)',
  SELECTION_BORDER: 'rgba(41, 136, 237, 1)',
  SELECTION_FILL: 'rgba(41, 136, 237, 0.2)',
} as const

export const NODE_SHAPE = {
  BODY: 'body',
  HEADER: 'header',
  NAME: 'name',
  CONTENT: 'content',
  RESIZE: 'resize',
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

/** Minimum node width a user can resize a node down to. */
export const NODE_MIN_WIDTH = 120

/** Minimum group width/height a user can resize a group down to. */
export const GROUP_MIN_WIDTH = 100
export const GROUP_MIN_HEIGHT = 80

/** Size of the corner resize grip (drawn as a triangle). */
export const RESIZE_HANDLE_SIZE = 12
export const BEZIER_MIN_OFFSET = 10
export const BEZIER_MAX_OFFSET = 200
export const EDGE_HIT_STROKE = 20
export const DASH_PATTERN: number[] = [8, 4]
export const HANDLE_CONTENT_X = LAYOUT.JOINT_RADIUS + 4
export const HANDLE_CONTENT_Y_OFFSET = 8
export const HANDLE_NAME_WIDTH = 60
export const HANDLE_NAME_GAP = 6
export const EXECUTOR_SHADOW_BLUR = 10
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

/**
 * Effective node height. Never smaller than the content-driven height
 * (header + handle rows + padding), even when `size.y` is set.
 */
export function getNodeHeight(node: Node): number {
  const handleCount = node.handles.length || 1
  const contentHeight =
    LAYOUT.HEADER_HEIGHT +
    handleCount * LAYOUT.HANDLE_ROW_HEIGHT +
    NODE_BODY_PADDING
  return Math.max(node.size.y, contentHeight)
}
