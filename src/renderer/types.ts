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
  GRID_COLOR: '#e5e5e5',
  SELECTION_BORDER: 'rgba(41, 136, 237, 1)',
  SELECTION_FILL: 'rgba(41, 136, 237, 0.2)',
} as const

export interface KonvaNodeEntry {
  group: import('konva').default.Group
  nodeId: number
}

export interface KonvaEdgeEntry {
  line: import('konva').default.Line
  edgeId: number
}

export interface KonvaGroupEntry {
  group: import('konva').default.Group
  groupId: number
}
