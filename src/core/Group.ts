import { GModel, type IGModel } from './Model'
import type { IGNode } from './Node'

export interface IGGroup extends IGModel {
  nodes: IGNode[]
}

export class GGroup extends GModel implements IGGroup {
  nodes = []
}
