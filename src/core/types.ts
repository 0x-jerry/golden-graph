export interface IVec2 {
  x: number
  y: number
}

export interface IGroup {
  id: number
  name: string

  nodes: number[]

  pos: IVec2

  size: IVec2
}

export interface INode {
  id: number
  type: string

  data?: Record<string, unknown>

  pos: IVec2
}

export interface INodeHandleLoc {
  /**
   * Node ID
   */
  id: number
  /**
   * Handle Key
   */
  key: string
}

export interface IEdge {
  id: number

  type: string

  start: INodeHandleLoc

  end: INodeHandleLoc
}

export interface ICoordinate {
  origin: IVec2
  scale: number
}

export interface IWorkspace {
  /**
   * For data migration
   */
  version: string

  extra: {
    incrementID: number
  }

  coordinate: ICoordinate

  nodes: INode[]
  edges: IEdge[]
  groups: IGroup[]
}

export type ObjectAny = Record<string, any>

export interface IDisposable {
  dispose(): void
}
