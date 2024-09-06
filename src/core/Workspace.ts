import type { GHandle } from './Handle'
import type { GNode } from './Node'
import { GEdge } from './Edge'
import { GModel } from './Model'
import { ModelManager } from './ModelManager'

export class GWorksapce extends GModel {
  nodes = new ModelManager<GNode>()
  edges = new ModelManager<GEdge>()

  addNode(node: GNode) {
    this.nodes.add(node)
  }

  connect(startHandle: GHandle, endHandle: GHandle) {
    if (startHandle.type !== endHandle.type) {
      return
    }

    // check startHandle, endHandle connections

    const edge = new GEdge()

    edge.start = startHandle
    edge.end = endHandle

    this.edges.add(edge)

    startHandle.onConnected(endHandle)
    endHandle.onConnected(startHandle, true)
  }
}
