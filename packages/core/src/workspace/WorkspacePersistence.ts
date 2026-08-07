import type { IWorkspace } from '@0x-jerry/golden-graph-protocol'
import { Edge } from '../Edge'
import { Group } from '../Group'
import type { Node } from '../Node'
import type { IPersistent } from '../Persistent'
import { SubGraph } from '../SubGraph'
import type { Workspace } from './Workspace'

/**
 * Serialization (`toJSON` / `fromJSON`) and graph reset (`clear`).
 *
 * `fromJSON` rebuilds the graph through the same mutation paths as the
 * interactive APIs so renderer events fire identically.
 */
export class WorkspacePersistence implements IPersistent<IWorkspace> {
  constructor(readonly ws: Workspace) {}

  clear() {
    for (const node of this.ws._nodes) {
      this.ws.events.emit('node:removed', node)
    }
    for (const edge of this.ws._edges) {
      // Same ordering as `removeEdgeByIds`: unindex + `edge:removed` before
      // `clearEndpoints()`, so `handle:connection-changed` handlers never
      // find a still-indexed edge whose view was already torn down.
      this.ws._unindexEdge(edge)
      this.ws.events.emit('edge:removed', edge)
      edge.clearEndpoints()
    }
    for (const group of this.ws._groups) {
      this.ws.events.emit('group:removed', group)
    }
    for (const sub of this.ws._subGraphs) {
      this.ws.events.emit('subgraph:removed', sub)
    }

    this.ws._groups.splice(0)
    this.ws._edges.splice(0)
    this.ws._edgeIndex.clear()
    this.ws._nodes.splice(0)
    this.ws._subGraphs.splice(0)

    this.ws._idGenerator.reset(0)

    this.ws.clearActiveIds()

    // NOTE: `_workspaceDataStack` is intentionally left untouched — `clear()`
    // is also used by `fromJSON()` during `enterSubGraph()`, which relies on
    // the stack to restore the parent workspace on `exitSubGraph()`.
  }

  toJSON(): IWorkspace {
    return {
      version: this.ws.version,
      coordinate: this.ws.coord.toJSON(),
      nodes: this.ws.nodes.map((n) => n.toJSON()),
      edges: this.ws.edges.map((n) => n.toJSON()),
      groups: this.ws.groups.map((n) => n.toJSON()),
      subGraphs: this.ws.subGraphs.map((n) => n.toJSON()),
      extra: {
        incrementID: this.ws._idGenerator.current(),
      },
    }
  }

  fromJSON(data: IWorkspace): void {
    if (data.version && data.version !== this.ws.version) {
      console.warn(
        `Workspace data version [${data.version}] differs from current version [${this.ws.version}]`,
      )
    }

    this.clear()

    this.ws._idGenerator.reset(data.extra.incrementID)

    this.ws.coord.fromJSON(data.coordinate)

    for (const subGraph of data.subGraphs) {
      const g = new SubGraph(this.ws)
      g.fromJSON(subGraph)

      this.ws.addSubGraph(g)
    }

    for (const node of data.nodes) {
      // Build and fully restore the node (id, position, data) BEFORE it is
      // registered and `node:added` fires. Creating it via `addNode` /
      // `addRawNode` first would emit the event with a temporary id and a
      // zero position — the renderer would keep a stale node group that is
      // never updated (position stays 0,0) and can never be hit-tested.
      let n: Node

      if (node.subGraphId) {
        const subGraph = this.ws._subGraphs.find(
          (g) => g.id === node.subGraphId,
        )
        if (!subGraph) {
          throw new Error(`Can not find SubGraph by id ${node.subGraphId}`)
        }

        // Build a SubGraphNode referencing the sub-graph.
        n = subGraph.buildNode()
      } else {
        const factory = this.ws._nodeRegister.get(node.type)
        if (!factory) {
          throw new Error(`Node [${node.type}] is not registered!`)
        }

        n = new factory()
        n._type = node.type
      }

      n.setWorkspace(this.ws)
      n.fromJSON(node)

      this.ws._nodes.push(n)
      this.ws.events.emit('node:added', n)
    }

    for (const edgeData of data.edges) {
      const edge = new Edge()
      edge.setWorkspace(this.ws)

      edge.fromJSON(edgeData)
      this.ws._addEdge(edge)
    }

    for (const group of data.groups) {
      const g = new Group()
      g.setWorkspace(this.ws)

      g.fromJSON(group)

      this.ws._groups.push(g)
      this.ws.events.emit('group:added', g)
    }
  }
}
