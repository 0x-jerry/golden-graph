import type { ISubGraph } from '@0x-jerry/golden-graph-protocol'
import type { Edge } from './Edge'
import { toReadonly } from './helper'
import type { Node } from './Node'
import type { IPersistent } from './Persistent'
import { SubGraphNode } from './SubGraphNode'
import type { IDisposable } from './types'
import { Workspace } from './Workspace'

/**
 * A virtual workspace used by `SubGraph` for its inner graph.
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

/**
 * A sub-graph container: the inner graph workspace plus the `SubGraphNode`s
 * on the parent graph that reference it. Multiple `SubGraphNode`s may share a
 * single sub-graph (e.g. copies made by `Workspace.copySubGraphNode`), so each
 * one is tracked in `nodes`.
 */
export class SubGraph implements IPersistent<ISubGraph>, IDisposable {
  id = 0

  _workspace: Workspace

  /** The `SubGraphNode`s on the parent graph that reference this sub-graph. */
  _nodes: SubGraphNode[] = []

  get workspace() {
    return toReadonly(this._workspace)
  }

  get nodes() {
    return toReadonly(this._nodes)
  }

  constructor(parentWorkspace: Workspace) {
    this._workspace = new VirtualWorkspace(parentWorkspace)
  }

  /**
   * Build a `SubGraphNode` referencing this sub-graph.
   */
  buildNode(): SubGraphNode {
    const node = new SubGraphNode(this)
    node.buildNode()

    this.attachNode(node)

    return node
  }

  attachNode(node: SubGraphNode) {
    if (!this._nodes.includes(node)) {
      this._nodes.push(node)
    }
  }

  detachNode(node: SubGraphNode) {
    const index = this._nodes.indexOf(node)
    if (index >= 0) {
      this._nodes.splice(index, 1)
    }
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
