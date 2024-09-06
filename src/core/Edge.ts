import type { IGHandle } from './Handle'
import { GModel, type IGModel } from './Model'
import type { IGNode } from './Node'

export interface IGEdgeNode {
  node: IGNode
  handle: IGHandle
}

export interface IGEdge extends IGModel {
  start?: IGEdgeNode
  end?: IGEdgeNode
}

export class GEdge extends GModel implements IGEdge {}
