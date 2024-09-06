import type { IGEdge } from './Edge'
import { GModel, type IGModel } from './Model'
import type { IGNode } from './Node'

export interface IGWrokspace extends IGModel {
  nodes: IGNode[]
  edges: IGEdge[]
}

export class GWorksapce extends GModel implements IGWrokspace {
  nodes = []
  edges = []
}
