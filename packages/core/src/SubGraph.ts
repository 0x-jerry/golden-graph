import type { Edge } from './Edge'
import { toReadonly } from './helper'
import { Node } from './Node'
import type { IPersistent } from './Persistent'
import {
  isSubGraphInputNode,
  isSubGraphOutputNode,
  subGraphInputToHandleConfig,
  subGraphOutputToHandleConfig,
} from './SubGraphSchema'
import type { IDisposable, ISubGraph } from './types'
import { Workspace } from './Workspace'

/**
 * A virtual workspace used by SubGraph
 */
class VirtualWorkspace extends Workspace {
  constructor(ws: Workspace) {
    super()

    for (const [name, factory] of ws.nodeRegister) {
      this._nodeRegister.set(name, factory)
    }

    this.fromJSON({
      version: ws.version,
      coordinate: ws.coord.toJSON(),
      nodes: [],
      edges: [],
      groups: [],
      subGraphs: [],
      extra: {
        incrementID: ws._idGenerator.current(),
      },
    })
  }
}

export class SubGraph implements IPersistent<ISubGraph>, IDisposable {
  id = 0

  _workspace: Workspace

  _node?: Node

  get node() {
    return toReadonly(this._node)
  }

  get workspace() {
    return toReadonly(this._workspace)
  }

  constructor(parentWorkspace: Workspace) {
    this._workspace = new VirtualWorkspace(parentWorkspace)
  }

  buildNode(): Node {
    const inputs = this.workspace.nodes.filter(isSubGraphInputNode)

    const outputs = this.workspace.nodes.filter(isSubGraphOutputNode)

    const node = new Node()
    node.setSubGraphId(this.id)

    for (const output of outputs) {
      node.addHandle(subGraphOutputToHandleConfig(output))
    }

    for (const input of inputs) {
      node.addHandle(subGraphInputToHandleConfig(input))
    }

    this._node = node
    return node
  }

  addNodes(...nodes: Node[]) {
    nodes.forEach((node) => {
      node.setWorkspace(this.workspace)
      node.id = this.workspace.nextId()

      this.workspace._nodes.push(node)
    })
  }

  addEdges(...edges: Edge[]) {
    edges.forEach((edge) => {
      edge.setWorkspace(this.workspace)
      edge.id = this.workspace.nextId()

      // Edges migrated from another workspace had their handle connections
      // cleared on removal — restore them so data keeps flowing.
      edge.restoreEndpoints()

      this.workspace._addEdge(edge)
    })
  }

  dispose() {
    this._workspace.dispose()
  }

  fromJSON(data: ISubGraph): void {
    this.id = data.id
    this.workspace.fromJSON(data.workspace)
  }

  toJSON(): ISubGraph {
    return {
      id: this.id,
      workspace: this.workspace.toJSON(),
    }
  }
}
