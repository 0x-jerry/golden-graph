import type { GEdge } from './Edge'
import { ModelManager } from './ModelManager'

export class EdgesManager {
  _edges = new ModelManager<GEdge>()

  add(edge: GEdge) {
    this.removeConnectedEdge(edge)

    this._edges.add(edge)
  }

  removeConnectedEdge(newEdge: GEdge) {
    this._edges.remove(newEdge.id)

    const startKey = newEdge.start.id
    const endKey = newEdge.end.id

    for (const [edgeKey, edge] of this._edges._data) {
      const shouldRemove =
        edge.start.id === startKey ||
        edge.end.id === startKey ||
        edge.start.id === endKey ||
        edge.end.id === endKey

      if (shouldRemove) {
        this._edges.remove(edgeKey)
      }
    }
  }
}
