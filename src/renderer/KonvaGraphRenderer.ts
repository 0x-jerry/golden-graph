import Konva from 'konva'
import type {
  Edge,
  Group,
  IDisposable,
  Node,
  NodeHandle,
  Workspace,
} from '../core'
import type { IRenderer } from '../core'
import { ActiveType, HandlePosition } from '../core'
import { createCoordLayer } from './CoordLayer'
import { createEdge } from './EdgeRenderer'
import { createGroup, updateGroup, destroyGroup } from './GroupRenderer'
import { InteractionManager } from './InteractionManager'
import { createNode, updateNode, destroyNode } from './NodeRenderer'
import { updateHandle } from './HandleRenderer'
import {
  COLORS,
  SEL,
  ATTR,
  LAYER_NAME,
  EXECUTOR_SHADOW_BLUR,
} from './constants'
import { Disposable } from '../utils/Disposable'
import type { IRect } from '../utils/RectBox'

export class KonvaGraphRenderer implements IRenderer, IDisposable {
  _stage: Konva.Stage
  _gridLayer: Konva.Layer
  _groupLayer: Konva.Layer
  _edgeLayer: Konva.Layer
  _nodeLayer: Konva.Layer
  _disposers = new Disposable()
  _ws: Workspace

  _nodeGroups = new Map<number, Konva.Group>()
  _edgeLines = new Map<number, Konva.Line>()
  _groupGroups = new Map<number, Konva.Group>()

  _interaction: InteractionManager
  _resizeObserver: ResizeObserver
  _disposed = false

  get stage(): Konva.Stage {
    return this._stage
  }

  constructor(container: HTMLElement, workspace: Workspace) {
    this._ws = workspace

    this._stage = new Konva.Stage({
      container: container as HTMLDivElement,
      width: container.clientWidth,
      height: container.clientHeight,
    })

    this._gridLayer = createCoordLayer(workspace.coord)
    this._groupLayer = new Konva.Layer({ name: LAYER_NAME.GROUPS })
    this._edgeLayer = new Konva.Layer({ name: LAYER_NAME.EDGES })
    this._nodeLayer = new Konva.Layer({ name: LAYER_NAME.NODES })

    this._stage.add(this._gridLayer)
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
      onNodeSelect: (id) => {
        workspace.setActiveIds(ActiveType.Node, [id])
      },
    })

    this._resizeObserver = new ResizeObserver(() => {
      this._stage.width(container.clientWidth)
      this._stage.height(container.clientHeight)
      this._gridLayer.batchDraw()
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
      const group = this._nodeGroups.get(id)
      if (!group) continue

      const node = this._ws.getNode(id)
      if (!node) continue

      const { width, height } = group.getSize()

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

  // --- Event Subscription ---

  _subscribe() {
    const ws = this._ws

    this._disposers.add(
      ws.events.on('node:added', (node) => {
        this._onNodeAdded(node)
        this._rebuildEdges()
      }),
    )

    this._disposers.add(
      ws.events.on('node:removed', (node) => {
        this._onNodeRemoved(node)
      }),
    )

    this._disposers.add(
      ws.events.on('node:changed', (node) => {
        this._onNodeChanged(node)
        this._rebuildEdgesForNode(node.id)
      }),
    )

    this._disposers.add(
      ws.events.on('edge:added', () => {
        this._rebuildEdges()
      }),
    )

    this._disposers.add(
      ws.events.on('edge:removed', () => {
        this._rebuildEdges()
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
        this._onGroupChanged(group)
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
    this._nodeGroups.clear()
    this._edgeLines.clear()
    this._groupGroups.clear()

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
    const group = createNode(node)
    group.setAttr(ATTR.ELEMENT_ID, node.id)

    this._nodeGroups.set(node.id, group)
    this._nodeLayer.add(group)
  }

  _onNodeRemoved(node: Node) {
    const group = this._nodeGroups.get(node.id)
    if (group) {
      destroyNode(group, node)
      this._nodeGroups.delete(node.id)
    }
  }

  _onNodeChanged(node: Node) {
    const group = this._nodeGroups.get(node.id)
    if (group) {
      updateNode(group, node)
    }
    this._nodeLayer.batchDraw()
  }

  // --- Edge ---

  _addEdgeLine(edge: Edge) {
    try {
      const line = createEdge(edge)
      this._edgeLines.set(edge.id, line)
      this._edgeLayer.add(line)
    } catch {
      // handle may not exist yet
    }
  }

  _rebuildEdges() {
    this._edgeLines.forEach((line) => line.destroy())
    this._edgeLines.clear()

    for (const edge of this._ws.edges) {
      this._addEdgeLine(edge)
    }

    this._edgeLayer.batchDraw()
  }

  _rebuildEdgesForNode(nodeId: number) {
    const relatedEdges = this._ws.queryConnectedEdges(nodeId)

    const removeIds = new Set<number>()
    for (const [id, line] of this._edgeLines) {
      if (relatedEdges.some((e) => e.id === id)) {
        line.destroy()
        removeIds.add(id)
      }
    }
    removeIds.forEach((id) => this._edgeLines.delete(id))

    for (const edge of relatedEdges) {
      if (!this._edgeLines.has(edge.id)) {
        this._addEdgeLine(edge)
      }
    }

    this._edgeLayer.batchDraw()
  }

  // --- Group ---

  _onGroupAdded(group: Group) {
    const konvaGroup = createGroup(group)
    konvaGroup.setAttr(ATTR.ELEMENT_ID, group.id)

    this._groupGroups.set(group.id, konvaGroup)
    this._groupLayer.add(konvaGroup)
  }

  _onGroupRemoved(group: Group) {
    const konvaGroup = this._groupGroups.get(group.id)
    if (konvaGroup) {
      destroyGroup(konvaGroup)
      this._groupGroups.delete(group.id)
    }
  }

  _onGroupChanged(group: Group) {
    const konvaGroup = this._groupGroups.get(group.id)
    if (konvaGroup) {
      updateGroup(konvaGroup, group)
    }
    this._groupLayer.batchDraw()
  }

  // --- Handle ---

  _onHandleUpdated(handle: NodeHandle) {
    const handles = handle.node.handles.filter(
      (h) => h.position !== HandlePosition.None,
    )
    const index = handles.indexOf(handle)
    if (index >= 0) {
      updateHandle(handle, index)
    }
    this._nodeLayer.batchDraw()
  }

  _onHandleConnectionChanged(handle: NodeHandle) {
    const handles = handle.node.handles.filter(
      (h) => h.position !== HandlePosition.None,
    )
    const index = handles.indexOf(handle)
    if (index >= 0) {
      updateHandle(handle, index)
    }
    this._nodeLayer.batchDraw()
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

    for (const [nodeId, group] of this._nodeGroups) {
      const isActive = state.activeIds.includes(nodeId)
      const body = group.findOne<Konva.Rect>(SEL.BODY)
      if (body) {
        body.stroke(isActive ? COLORS.ACCENT : COLORS.BORDER)
      }
    }

    for (const [groupId, group] of this._groupGroups) {
      const isActive = state.activeIds.includes(groupId)
      const body = group.findOne<Konva.Rect>(SEL.BODY)
      if (body) {
        body.stroke(isActive ? COLORS.ACCENT : COLORS.GROUP_BORDER)
      }
    }

    this._nodeLayer.batchDraw()
    this._groupLayer.batchDraw()
  }

  // --- Executor ---

  _syncExecutor() {
    const { executorState } = this._ws

    for (const [nodeId, group] of this._nodeGroups) {
      const body = group.findOne<Konva.Rect>(SEL.BODY)
      if (body) {
        if (
          executorState.isProcessing &&
          executorState.currentNodeId === nodeId
        ) {
          body.shadowColor(COLORS.ACCENT_SOFT)
          body.shadowBlur(EXECUTOR_SHADOW_BLUR)
          body.shadowOffset({ x: 0, y: 0 })
          body.shadowEnabled(true)
        } else {
          body.shadowEnabled(false)
        }
      }
    }

    this._nodeLayer.batchDraw()
  }

  // --- Lifecycle ---

  dispose() {
    this._disposed = true
    this._disposers.dispose()
    this._interaction.dispose()
    this._resizeObserver.disconnect()

    this._nodeGroups.forEach((group, nodeId) => {
      const node = this._ws.getNode(nodeId)
      if (node) {
        destroyNode(group, node)
      }
    })
    this._nodeGroups.clear()
    this._edgeLines.clear()
    this._groupGroups.clear()

    this._stage.destroy()
  }
}
