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

  subGraphId?: number

  pos: IVec2

  /**
   * Optional size override. `x`/`y` of `0` mean "auto" — the renderer falls
   * back to its default layout width / content-driven height.
   */
  size?: IVec2

  /**
   * Optional collapse flag. Missing/false = expanded. When collapsed the
   * renderer shows the header only (handle rows and joints are hidden, and
   * connected edges dock at the header line).
   */
  collapsed?: boolean
}

export interface INodeHandleLoc {
  id: number
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

  subGraphs: ISubGraph[]
}

export interface ISubGraph {
  id: number
  workspace: IWorkspace
}
