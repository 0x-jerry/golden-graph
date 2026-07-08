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

export type { HandleModule } from './handles/types'
