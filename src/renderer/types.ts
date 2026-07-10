import type Konva from 'konva'

export interface KonvaNodeEntry {
  group: Konva.Group
  nodeId: number
}

export interface KonvaEdgeEntry {
  line: Konva.Line
  edgeId: number
}

export interface KonvaGroupEntry {
  group: Konva.Group
  groupId: number
}

export interface ContextMenuContext {
  type: 'canvas' | 'node' | 'group'
  nodeId?: number
  groupId?: number
}

export type { HandleModule } from './handles/types'
