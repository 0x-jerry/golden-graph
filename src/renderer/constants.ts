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
} as const

export const SEL = {
  BODY: '.body',
  HEADER: '.header',
  NAME: '.name',
  CONTENT: '.content',
} as const

export const NODE_BODY_PADDING = 8
export const BEZIER_MIN_OFFSET = 10
export const BEZIER_MAX_OFFSET = 200
export const EDGE_HIT_STROKE = 20
export const DASH_PATTERN: number[] = [8, 4]
export const HANDLE_CONTENT_X = LAYOUT.JOINT_RADIUS + 4
export const HANDLE_CONTENT_Y_OFFSET = 8
export const EXECUTOR_SHADOW_BLUR = 10
export const ZOOM_MIN = 0.01
export const ZOOM_MAX = 2
