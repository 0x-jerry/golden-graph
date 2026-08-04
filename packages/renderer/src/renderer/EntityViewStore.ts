import Konva from 'konva'
import type { Edge, Group, Node, Workspace } from '@0x-jerry/golden-graph'
import { EdgeView } from './EdgeView'
import type { EntityView } from './EntityView'
import { GroupView } from './GroupView'
import { NodeView } from './NodeView'
import type { IRect } from '../utils/RectBox'
import { LAYER_NAME, getNodeHeight, getNodeWidth } from './constants'

/**
 * Map of entity views keyed by entity id. `add` draws the view into the given
 * layer, `remove`/`destroyAll` tear down views, keeping map and scene in sync.
 */
export class EntityViewMap<V extends EntityView<unknown>> extends Map<number, V> {
  add(layer: Konva.Layer, id: number, view: V) {
    this.set(id, view)
    layer.add(view.group)
  }

  remove(id: number) {
    const view = this.get(id)
    if (view) {
      view.destroy()
      this.delete(id)
    }
  }

  destroyAll() {
    for (const view of this.values()) view.destroy()
    this.clear()
  }
}

/**
 * Owns the rendered entity views and their layers. Mutations only change view
 * state — callers decide when to redraw via `redrawNodes/Edges/Groups`.
 */
export class EntityViewStore {
  _ws: Workspace
  nodeLayer: Konva.Layer
  edgeLayer: Konva.Layer
  groupLayer: Konva.Layer

  _nodeViews = new EntityViewMap<NodeView>()
  _edgeViews = new EntityViewMap<EdgeView>()
  _groupViews = new EntityViewMap<GroupView>()

  constructor(ws: Workspace) {
    this._ws = ws
    this.groupLayer = new Konva.Layer({ name: LAYER_NAME.GROUPS })
    this.edgeLayer = new Konva.Layer({ name: LAYER_NAME.EDGES })
    this.nodeLayer = new Konva.Layer({ name: LAYER_NAME.NODES })
  }

  getNodesBounding(nodeIds: number[]): IRect {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity

    for (const id of nodeIds) {
      const node = this._ws.getNode(id)
      if (!node) continue

      const width = getNodeWidth(node)
      const height = getNodeHeight(node)

      left = Math.min(left, node.pos.x)
      top = Math.min(top, node.pos.y)
      right = Math.max(right, node.pos.x + width)
      bottom = Math.max(bottom, node.pos.y + height)
    }

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    }
  }

  // --- Node ---

  addNode(node: Node) {
    this._nodeViews.add(this.nodeLayer, node.id, new NodeView(node))
  }

  removeNode(node: Node) {
    this._nodeViews.remove(node.id)
  }

  updateNode(node: Node) {
    this._nodeViews.get(node.id)?.update()
  }

  // --- Edge ---

  addEdgeLine(edge: Edge) {
    try {
      const view = new EdgeView(edge)
      this._edgeViews.add(this.edgeLayer, edge.id, view)

      view.closeButton.on('click', () => {
        this._ws.removeEdgeByIds(edge.id)
      })
    } catch {
      // handle may not exist yet
    }
  }

  removeEdge(edge: Edge) {
    this._edgeViews.remove(edge.id)
  }

  rebuildEdgesForNode(nodeId: number) {
    const relatedEdges = this._ws.queryConnectedEdges(nodeId)

    for (const edge of relatedEdges) {
      const view = this._edgeViews.get(edge.id)
      if (view) {
        // Update geometry in place to avoid Konva object churn while dragging.
        try {
          view.update()
        } catch {
          // handle may not exist yet
        }
      } else {
        this.addEdgeLine(edge)
      }
    }
  }

  // --- Group ---

  addGroup(group: Group) {
    this._groupViews.add(this.groupLayer, group.id, new GroupView(group))
  }

  removeGroup(group: Group) {
    this._groupViews.remove(group.id)
  }

  updateGroup(group: Group) {
    this._groupViews.get(group.id)?.update()
  }

  // --- Read / redraw (for state projections) ---

  forEachNodeView(fn: (view: NodeView) => void) {
    for (const view of this._nodeViews.values()) fn(view)
  }

  forEachGroupView(fn: (view: GroupView) => void) {
    for (const view of this._groupViews.values()) fn(view)
  }

  redrawNodes() {
    this.nodeLayer.batchDraw()
  }

  redrawEdges() {
    this.edgeLayer.batchDraw()
  }

  redrawGroups() {
    this.groupLayer.batchDraw()
  }

  // --- Full render ---

  renderAll() {
    this.nodeLayer.destroyChildren()
    this.edgeLayer.destroyChildren()
    this.groupLayer.destroyChildren()

    this._nodeViews.destroyAll()
    this._edgeViews.destroyAll()
    this._groupViews.destroyAll()

    for (const node of this._ws.nodes) {
      this.addNode(node)
    }

    for (const edge of this._ws.edges) {
      this.addEdgeLine(edge)
    }

    for (const group of this._ws.groups) {
      this.addGroup(group)
    }

    this.redrawNodes()
    this.redrawEdges()
    this.redrawGroups()
  }

  destroyAll() {
    this._nodeViews.destroyAll()
    this._edgeViews.destroyAll()
    this._groupViews.destroyAll()
  }
}
