import { GModel } from './Model'
import type { GNode } from './Node'

export class GGroup extends GModel {
  nodes: GNode[] = []
}
