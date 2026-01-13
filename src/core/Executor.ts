import type { Arrayable } from '@0x-jerry/utils'
import type { Node } from './Node'
import type { Workspace } from './Workspace'

export class Executor {
  constructor(readonly ws: Workspace) {}

  execute(startNodeIds: Arrayable<number> = []) {
    // this._workspace.nodes.forEach((node) => {
    //   node.onProcess?.(node)
    // })
  }

  process(node: Node) {
    // node.onProcess?.(node)
  }
}
