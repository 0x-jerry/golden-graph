import Konva from 'konva'
import type {
  Edge,
  Group,
  IDisposable,
  Node,
  NodeHandle,
  Workspace,
  IRenderer,
} from '@0x-jerry/golden-graph'
import { ActiveType, Disposable } from '@0x-jerry/golden-graph'
import { CoordLayer } from './CoordLayer'
import { EdgeView } from './EdgeView'
import { GroupView } from './GroupView'
import { InteractionManager } from './InteractionManager'
import type { ContextMenuContext, CoreMenuItem } from './types'
import { NodeView, getHandleIndex } from './NodeView'
import { getHandleView } from './HandleView'
import { disposeHandleEditors } from './handles'
import { LAYER_NAME } from './constants'
import type { IRect } from '../utils/RectBox'
import { ActiveElementManager } from './ActiveElementManager'

export interface KonvaGraphRendererOptions {
  onContextMenu?: (
    ctx: ContextMenuContext,
    evt: PointerEvent,
    menus: CoreMenuItem[],
  ) => void
}

export class KonvaGraphRenderer implements IRenderer, IDisposable {
  _stage: Konva.Stage
  _gridLayer: CoordLayer
  _groupLayer: Konva.Layer
  _edgeLayer: Konva.Layer
  _nodeLayer: Konva.Layer
  _disposers = new Disposable()
  _ws: Workspace

  _nodeViews = new Map<number, NodeView>()
  _edgeViews = new Map<number, EdgeView>()
  _groupViews = new Map<number, GroupView>()

  _interaction: InteractionManager
  _resizeObserver: ResizeObserver
  _disposed = false
  _activeElementManager: ActiveElementManager

  get stage(): Konva.Stage {
    return this._stage
  }

  constructor(
    container: HTMLElement,
    workspace: Workspace,
    options?: KonvaGraphRendererOptions,
  ) {
    this._ws = workspace

    this._stage = new Konva.Stage({
      container: container as HTMLDivElement,
      width: container.clientWidth,
      height: container.clientHeight,
    })

    this._activeElementManager = new ActiveElementManager(this._stage)
    this._stage.setAttr(ActiveElementManager.key, this._activeElementManager)
    this._activeElementManager.init()

    this._gridLayer = new CoordLayer(workspace.coord)
    this._groupLayer = new Konva.Layer({ name: LAYER_NAME.GROUPS })
    this._edgeLayer = new Konva.Layer({ name: LAYER_NAME.EDGES })
    this._nodeLayer = new Konva.Layer({ name: LAYER_NAME.NODES })

    this._stage.add(this._gridLayer.layer)
    this._stage.add(this._groupLayer)
    this._stage.add(this._edgeLayer)
    this._stage.add(this._nodeLayer)

    this._subscribe()

    workspace.setRenderer(this)

    this._fullRender()

    this._interaction = new InteractionManager({
      stage: this._stage,
      ws: workspace,
      edgeLayer: this._edgeLayer,
      nodeLayer: this._nodeLayer,
      onNodeSelect: (id) => {
        workspace.setActiveIds(ActiveType.Node, [id])
      },
      onContextMenu: options?.onContextMenu,
    })

    this._resizeObserver = new ResizeObserver(() => {
      this._stage.width(container.clientWidth)
      this._stage.height(container.clientHeight)
      this._gridLayer.redraw()
    })
    this._resizeObserver.observe(container)
  }

  // --- IRenderer implementation ---

  getNodesBounding(nodeIds: number[]): IRect {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity

    for (const id of nodeIds) {
      const view = this._nodeViews.get(id)
      if (!view) continue

      const node = this._ws.getNode(id)
      if (!node) continue

      const { width, height } = view.group.getSize()

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

  getViewportCenter() {
    return {
      x: this._stage.width() / 2,
      y: this._stage.height() / 2,
    }
  }

  // --- Event Subscription ---

  _subscribe() {
    const ws = this._ws

    this._disposers.add(
      ws.events.on('node:added', (node) => {
        this._onNodeAdded(node)
        // Only edges connected to the new node can be affected (e.g. an edge
        // whose line was skipped earlier because the node did not exist yet).
        this._rebuildEdgesForNode(node.id)
      }),
    )

    this._disposers.add(
      ws.events.on('node:removed', (node) => {
        this._onNodeRemoved(node)
      }),
    )

    this._disposers.add(
      ws.events.on('node:changed', (node) => {
        this._nodeViews.get(node.id)?.update()
        this._nodeLayer.batchDraw()
        this._rebuildEdgesForNode(node.id)
      }),
    )

    this._disposers.add(
      ws.events.on('edge:added', (edge) => {
        this._addEdgeLine(edge)
        this._edgeLayer.batchDraw()
      }),
    )

    this._disposers.add(
      ws.events.on('edge:removed', (edge) => {
        const view = this._edgeViews.get(edge.id)
        if (view) {
          view.destroy()
          this._edgeViews.delete(edge.id)
        }
        this._edgeLayer.batchDraw()
      }),
    )

    this._disposers.add(
      ws.events.on('group:added', (group) => {
        this._onGroupAdded(group)
      }),
    )

    this._disposers.add(
      ws.events.on('group:removed', (group) => {
        this._onGroupRemoved(group)
      }),
    )

    this._disposers.add(
      ws.events.on('group:changed', (group) => {
        this._groupViews.get(group.id)?.update()
        this._groupLayer.batchDraw()
      }),
    )

    this._disposers.add(
      ws.events.on('coord:changed', () => {
        this._syncCoord()
      }),
    )

    this._disposers.add(
      ws.events.on('state:changed', () => {
        this._syncState()
      }),
    )

    this._disposers.add(
      ws.events.on('executor:changed', () => {
        this._syncExecutor()
      }),
    )

    this._disposers.add(
      ws.events.on('handle:updated', (handle) => {
        this._onHandleUpdated(handle)
      }),
    )

    this._disposers.add(
      ws.events.on('handle:connection-changed', (handle) => {
        this._onHandleConnectionChanged(handle)
        this._rebuildEdgesForNode(handle.node.id)
      }),
    )
  }

  // --- Full Render ---

  _fullRender() {
    this._nodeLayer.destroyChildren()
    this._edgeLayer.destroyChildren()
    this._groupLayer.destroyChildren()

    for (const view of this._nodeViews.values()) {
      view.destroy()
    }
    this._nodeViews.clear()
    for (const view of this._edgeViews.values()) {
      view.destroy()
    }
    this._edgeViews.clear()
    for (const view of this._groupViews.values()) {
      view.destroy()
    }
    this._groupViews.clear()

    for (const node of this._ws.nodes) {
      this._onNodeAdded(node)
    }

    for (const edge of this._ws.edges) {
      this._addEdgeLine(edge)
    }

    for (const group of this._ws.groups) {
      this._onGroupAdded(group)
    }

    this._syncCoord()
    this._syncState()

    this._nodeLayer.batchDraw()
    this._edgeLayer.batchDraw()
    this._groupLayer.batchDraw()
  }

  // --- Node ---

  _onNodeAdded(node: Node) {
    const view = new NodeView(node)
    this._nodeViews.set(node.id, view)
    this._nodeLayer.add(view.group)
  }

  _onNodeRemoved(node: Node) {
    const view = this._nodeViews.get(node.id)
    if (view) {
      view.destroy()
      this._nodeViews.delete(node.id)
    }
  }

  // --- Edge ---

  _addEdgeLine(edge: Edge) {
    try {
      const view = new EdgeView(edge)
      this._edgeViews.set(edge.id, view)
      this._edgeLayer.add(view.group)

      view.closeButton.on('click', () => {
        this._ws.removeEdgeByIds(edge.id)
      })
    } catch {
      // handle may not exist yet
    }
  }

  _rebuildEdgesForNode(nodeId: number) {
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
        this._addEdgeLine(edge)
      }
    }

    this._edgeLayer.batchDraw()
  }

  // --- Group ---

  _onGroupAdded(group: Group) {
    const view = new GroupView(group)
    this._groupViews.set(group.id, view)
    this._groupLayer.add(view.group)
  }

  _onGroupRemoved(group: Group) {
    const view = this._groupViews.get(group.id)
    if (view) {
      view.destroy()
      this._groupViews.delete(group.id)
    }
  }

  // --- Handle ---

  _onHandleUpdated(handle: NodeHandle) {
    this._updateHandleView(handle)

    const edges = this._ws.queryEdges(handle.loc)
    for (const edge of edges) {
      const otherHandle = edge.start === handle ? edge.end : edge.start
      this._updateHandleView(otherHandle)
    }

    this._nodeLayer.batchDraw()
  }

  _onHandleConnectionChanged(handle: NodeHandle) {
    this._updateHandleView(handle)
    this._nodeLayer.batchDraw()
  }

  _updateHandleView(handle: NodeHandle) {
    const index = getHandleIndex(handle.node, handle)
    if (index >= 0) {
      getHandleView(handle)?.update(index)
    }
  }

  // --- Coord ---

  _syncCoord() {
    const { coord } = this._ws
    this._stage.scaleX(coord.scale)
    this._stage.scaleY(coord.scale)
    this._stage.x(coord.origin.x * coord.scale)
    this._stage.y(coord.origin.y * coord.scale)
    this._stage.batchDraw()
  }

  // --- State ---

  _syncState() {
    const { state } = this._ws

    for (const [nodeId, view] of this._nodeViews) {
      view.setActive(state.activeIds.includes(nodeId))
    }

    for (const [groupId, view] of this._groupViews) {
      view.setActive(state.activeIds.includes(groupId))
    }

    this._nodeLayer.batchDraw()
    this._groupLayer.batchDraw()
  }

  // --- Executor ---

  _syncExecutor() {
    const { executorState } = this._ws

    for (const [nodeId, view] of this._nodeViews) {
      view.setExecuteHighlight(
        executorState.isProcessing,
        executorState.currentNodeId === nodeId,
      )
    }

    this._nodeLayer.batchDraw()
  }

  // --- Lifecycle ---

  dispose() {
    this._disposed = true

    this._activeElementManager.dispose()
    this._disposers.dispose()
    this._interaction.dispose()
    this._resizeObserver.disconnect()
    disposeHandleEditors()

    for (const view of this._nodeViews.values()) {
      view.destroy()
    }
    this._nodeViews.clear()
    for (const view of this._edgeViews.values()) {
      view.destroy()
    }
    this._edgeViews.clear()
    for (const view of this._groupViews.values()) {
      view.destroy()
    }
    this._groupViews.clear()

    this._stage.destroy()

    // Detach from the workspace so later core calls (e.g. addGroup) fail
    // with a clear error instead of touching a destroyed stage.
    this._ws.setRenderer(undefined)
  }
}