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

export enum ContextMenuTargetType {
  Canvas = 'canvas',
  Node = 'node',
  Group = 'group',
}

export interface ContextMenuContext {
  type: ContextMenuTargetType
  /** Target element id */
  id?: number
  /** Pointer position in workspace coordinates (canvas target only) */
  pos?: { x: number; y: number }
}

export interface CoreMenuItem {
  key?: string | number
  label: string
  icon?: string
  disabled?: boolean
  shortcut?: string
  visible?: boolean | (() => boolean)
  action?: () => void
  children?: CoreMenuItem[]
}

export type { NodeHandleFactory, NodeHandleModule } from './handles/types'
