import { remove } from '@0x-jerry/utils'
import { uniq } from 'lodash-es'
import { Edge } from '../Edge'
import { edgeLocKey } from '../helper'
import type { NodeHandle } from '../NodeHandle'
import type { INodeHandleLoc } from '../types'
import type { Workspace } from './Workspace'

/**
 * Edge CRUD plus the endpoint index that backs `queryEdges`.
 *
 * Mutates `ws._edges` / `ws._edgeIndex` in place and emits `edge:added` /
 * `edge:removed` events.
 */
export class EdgeManager {
  constructor(readonly ws: Workspace) {}

  canConnect(start: NodeHandle, end: NodeHandle): boolean {
    if (start.position === end.position) {
      return false
    }

    return start.canConnectTo(end)
  }

  connect(start: NodeHandle, end: NodeHandle) {
    if (!this.canConnect(start, end)) {
      console.warn('handle %o can not connect to handle %o', start.loc, end.loc)
      return
    }

    const inputHandle = start.isLeft ? start : end
    this.removeConnectedEdgesByHandle(inputHandle)

    const edge = new Edge()
    edge.setWorkspace(this.ws)
    edge.id = this.ws.nextId()

    edge.setEndpoints(start, end)

    this._addEdge(edge)

    return edge
  }

  /**
   * Add an edge to the workspace, keep the edge index up-to-date and emit
   * `edge:added`.
   * @internal
   */
  _addEdge(edge: Edge) {
    this.ws._edges.push(edge)
    this._indexEdge(edge)
    this.ws.events.emit('edge:added', edge)
  }

  _indexEdge(edge: Edge) {
    for (const loc of [edge.start.loc, edge.end.loc]) {
      const key = edgeLocKey(loc)
      const list = this.ws._edgeIndex.get(key)
      if (list) {
        list.push(edge)
      } else {
        this.ws._edgeIndex.set(key, [edge])
      }
    }
  }

  _unindexEdge(edge: Edge) {
    if (!edge._start || !edge._end) {
      return
    }

    for (const loc of [edge._start.loc, edge._end.loc]) {
      const key = edgeLocKey(loc)
      const list = this.ws._edgeIndex.get(key)
      if (!list) {
        continue
      }

      const filtered = list.filter((e) => e !== edge)
      if (filtered.length) {
        this.ws._edgeIndex.set(key, filtered)
      } else {
        this.ws._edgeIndex.delete(key)
      }
    }
  }

  removeConnectedEdgesByHandle(handle: NodeHandle) {
    const edges = this.queryEdges(handle.loc)
    this.removeEdgeByIds(...edges.map((e) => e.id))
  }

  queryConnectedEdges(...nodeIds: number[]) {
    const handles = nodeIds.flatMap((id) => {
      const node = this.ws.getNode(id)
      if (!node) {
        return []
      }

      return node.handles
    })

    const edges = handles.flatMap((handle) => this.queryEdges(handle.loc))

    return uniq(edges)
  }

  queryEdges(loc: INodeHandleLoc) {
    return this.ws._edgeIndex.get(edgeLocKey(loc)) ?? []
  }

  removeEdgeByIds(...ids: number[]) {
    const edges = remove(this.ws._edges, (e) => ids.includes(e.id))
    for (const edge of edges) {
      // Detach and notify BEFORE clearing endpoints: `clearEndpoints()`
      // fires `handle:connection-changed`, and subscribers may rebuild edge
      // views via the edge index. If the edge were still queryable, a view
      // that was just torn down by `edge:removed` could be re-created.
      this._unindexEdge(edge)
      this.ws.events.emit('edge:removed', edge)
      edge.clearEndpoints()
    }

    return edges
  }
}
