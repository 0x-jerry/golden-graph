import type Konva from 'konva'
import type { NodeHandle, Workspace } from '@0x-jerry/golden-graph'
import { getHandleView } from './HandleView'
import { getHandleIndex } from './NodeView'
import type { EntityViewStore } from './EntityViewStore'

/**
 * Projects workspace state onto the rendered views: coordinate transform,
 * selection / execution highlighting and handle data changes.
 */
export class GraphStateSyncer {
  _ws: Workspace
  _stage: Konva.Stage
  _store: EntityViewStore

  constructor(ws: Workspace, stage: Konva.Stage, store: EntityViewStore) {
    this._ws = ws
    this._stage = stage
    this._store = store
  }

  syncCoord() {
    const { coord } = this._ws
    this._stage.scaleX(coord.scale)
    this._stage.scaleY(coord.scale)
    this._stage.x(coord.origin.x * coord.scale)
    this._stage.y(coord.origin.y * coord.scale)
    this._stage.batchDraw()
  }

  syncState() {
    const { state } = this._ws

    this._store.forEachNodeView((view) => {
      view.setActive(state.activeIds.includes(view.entity.id))
    })
    this._store.forEachGroupView((view) => {
      view.setActive(state.activeIds.includes(view.entity.id))
    })

    this._store.redrawNodes()
    this._store.redrawGroups()
  }

  syncExecutor() {
    const { executorState } = this._ws

    this._store.forEachNodeView((view) => {
      view.setExecuteHighlight(
        executorState.isProcessing,
        executorState.currentNodeId === view.entity.id,
      )
    })

    this._store.redrawNodes()
  }

  onHandleUpdated(handle: NodeHandle) {
    this._updateHandleView(handle)

    const edges = this._ws.queryEdges(handle.loc)
    for (const edge of edges) {
      const otherHandle = edge.start === handle ? edge.end : edge.start
      this._updateHandleView(otherHandle)
    }

    // Re-sync the owning node: a value change can re-flow block content
    // (wrapping text, images) into the node's allocated space. Content is
    // contained to the node's size and never expands it.
    this._store.updateNode(handle.node)
    this._store.redrawNodes()
  }

  onHandleConnectionChanged(handle: NodeHandle) {
    this._updateHandleView(handle)
    this._store.redrawNodes()
  }

  _updateHandleView(handle: NodeHandle) {
    if (getHandleIndex(handle.node, handle) >= 0) {
      getHandleView(handle)?.update()
    }
  }
}
