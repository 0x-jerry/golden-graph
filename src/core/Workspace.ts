import type { GHandle } from './Handle'
import type { GNode } from './Node'
import { GEdge } from './Edge'
import { GModel } from './Model'
import { ModelManager } from './ModelManager'
import { EdgesManager } from './EdgesManager'

export class GWorksapce extends GModel {
  nodes = new ModelManager<GNode>()
  edges = new EdgesManager()

  addNode(node: GNode) {
    this.nodes.add(node)
  }

  connect(startHandle: GHandle, endHandle: GHandle) {
    if (startHandle.type !== endHandle.type) {
      return
    }

    const edge = new GEdge(startHandle, endHandle)

    this.edges.add(edge)

    startHandle.onConnected(endHandle)
    endHandle.onConnected(startHandle, true)
  }
}
