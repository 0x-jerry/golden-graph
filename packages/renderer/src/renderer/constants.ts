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
  // --- Node surfaces (neutral warm-gray) ---
  BG: '#ffffff',
  BORDER: '#d9d9de',
  HEADER_BG: '#f5f5f7',
  TEXT_PRIMARY: '#1f2328',
  /** Handle / parameter labels — small 12px text, needs extra contrast. */
  TEXT_LABEL: '#4b5563',
  TEXT_MUTED: '#5f6670',

  // --- Accent (indigo) ---
  ACCENT: '#6366f1',
  /** Executor glow while a node is running. */
  ACCENT_SOFT: 'rgba(99, 102, 241, 0.3)',

  // --- SubGraph node tag ---
  SUBGRAPH_TAG_BG: '#eef2ff',
  SUBGRAPH_TAG_TEXT: '#4f46e5',

  // --- Edges & joints (rose) ---
  EDGE: 'rgba(225, 93, 118, 0.5)',
  EDGE_WIDTH: 3,
  JOINT_DEFAULT: '#9ca3af',
  /** Joint fill while a connection drag is hovering a compatible handle. */
  JOINT_HIGHLIGHT: '#6366f1',

  // --- Groups (indigo tint) ---
  GROUP_BG: 'rgba(129, 140, 248, 0.1)',
  GROUP_BORDER: '#a5b4fc',
  GROUP_HEADER_BG: 'rgba(99, 102, 241, 0.08)',

  // --- Canvas ---
  GRID_COLOR: '#e9e9ee',

  // --- Selection ---
  SELECTION_BORDER: '#6366f1',
  SELECTION_FILL: 'rgba(99, 102, 241, 0.12)',
} as const

export const NODE_SHAPE = {
  BODY: 'body',
  HEADER: 'header',
  NAME: 'name',
  CONTENT: 'content',
  RESIZE: 'resize',
  TAG: 'tag',
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

/**
 * Screen-pixel radius around a joint that auto-targets it during a
 * connection drag, so users don't need to aim exactly at the small joint.
 * Set the renderer's `proximityRadius` to 0 to disable.
 */
export const PROXIMITY_RADIUS = 24
export const BEZIER_MIN_OFFSET = 10
export const BEZIER_MAX_OFFSET = 200
export const EDGE_HIT_STROKE = 20
export const DASH_PATTERN: number[] = [8, 4]
export const HANDLE_CONTENT_X = LAYOUT.JOINT_RADIUS + 4
export const HANDLE_CONTENT_Y_OFFSET = 8
export const HANDLE_NAME_WIDTH = 60
export const HANDLE_NAME_GAP = 6
/** Height of the label row inside a block-layout handle's row. */
export const BLOCK_HANDLE_LABEL_ROW = LAYOUT.HANDLE_ROW_HEIGHT
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
