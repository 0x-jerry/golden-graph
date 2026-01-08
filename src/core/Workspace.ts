import { GEdge } from './Edge'
import { EdgesManager } from './EdgesManager'
import type { GHandle } from './Handle'
import { GModel } from './Model'
import { ModelManager } from './ModelManager'
import type { GNode } from './Node'

export class GWorkspace extends GModel {
  nodes = new ModelManager<GNode>()
  edges = new EdgesManager()

  addNode(node: GNode) {
    this.nodes.add(node)
  }

  connect(startHandle: GHandle, endHandle: GHandle) {
    if (startHandle.valueType !== endHandle.valueType) {
      return
    }

    if (startHandle.handleType === endHandle.handleType) {
      return
    }

    if (startHandle.node === endHandle.node) {
      return
    }

    const edge = new GEdge(startHandle, endHandle)

    this.edges.add(edge)

    startHandle.onConnected(endHandle)
    endHandle.onConnected(startHandle, true)
  }
}
