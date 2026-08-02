import Konva from 'konva'
import { clamp } from '@0x-jerry/utils'
import type { NodeHandle, Workspace } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import type { ContextMenuContext, CoreMenuItem } from './types'
import { ContextMenuTargetType } from './types'
import { buildDefaultContextMenu } from './ContextMenuBuilder'
import { ConnectionLine } from './ConnectionLine'
import { getJointPos } from './EdgeRenderer'
import { setJointHighlight } from './HandleRenderer'
import {
  COLORS,
  DRAG_TYPE,
  NODE_MIN_WIDTH,
  NODE_SHAPE,
  ZOOM_MIN,
  ZOOM_MAX,
  ELEMENT_TYPE,
  ATTR,
  getZoomStep,
  getNodeWidth,
  getNodeHeight,
} from './constants'

export interface InteractionManagerOptions {
  stage: Konva.Stage
  ws: Workspace
  edgeLayer: Konva.Layer
  /**
   * Top-most content layer — the rubber-band selection rect is drawn here
   * so it stays visible above nodes/edges/groups.
   */
  nodeLayer: Konva.Layer
  onNodeSelect: (id: number) => void
  onContextMenu?: (
    ctx: ContextMenuContext,
    evt: PointerEvent,
    menus: CoreMenuItem[],
  ) => void
}

export class InteractionManager {
  _stage: Konva.Stage
  _ws: Workspace
  _nodeLayer: Konva.Layer
  _connectionLine: ConnectionLine

  _dragType: string | null = null
  _dragNodeId = 0
  _dragGroupId = 0
  _dragLastPos = { x: 0, y: 0 }

  _isConnecting = false
  _connectHandle: NodeHandle | null = null
  _connectTargetHandle: NodeHandle | null = null

  _selectionStarted = false
  _selectionX1 = 0
  _selectionY1 = 0
  _selectionRect: Konva.Rect | null = null

  _onNodeSelect: (id: number) => void
  _onContextMenu?: (
    ctx: ContextMenuContext,
    evt: PointerEvent,
    menus: CoreMenuItem[],
  ) => void

  constructor(opts: InteractionManagerOptions) {
    this._stage = opts.stage
    this._ws = opts.ws
    this._nodeLayer = opts.nodeLayer
    this._connectionLine = new ConnectionLine(opts.edgeLayer)
    this._onNodeSelect = opts.onNodeSelect
    this._onContextMenu = opts.onContextMenu
    this._setupStageEvents()
  }

  _setupStageEvents() {
    const stage = this._stage

    stage.on('pointerdown', this._onPointerDown)
    stage.on('pointermove', this._onPointerMove)
    stage.on('pointerup', this._onPointerUp)
    stage.on('wheel', this._onWheel)
    stage.on('contextmenu', this._onContextMenuEvent)
  }

  _onContextMenuEvent = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault()
    this._handleContextMenu(e)
  }

  _handleContextMenu(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!this._onContextMenu) return

    const ctx = this._resolveContextTarget(e)
    if (!ctx) return

    if (ctx.type === ContextMenuTargetType.Node) {
      this._onNodeSelect(ctx.id!)
    } else if (ctx.type === ContextMenuTargetType.Group) {
      this._ws.setActiveIds(ActiveType.Group, [ctx.id!])
    }

    this._onContextMenu(ctx, e.evt, buildDefaultContextMenu(ctx, this._ws))
  }

  _resolveContextTarget(
    e: Konva.KonvaEventObject<PointerEvent>,
  ): ContextMenuContext | null {
    const hit = this._hitTarget(e.target as Konva.Node)
    if (hit) {
      return { type: hit.type, id: hit.id }
    }

    const ctx: ContextMenuContext = { type: ContextMenuTargetType.Canvas }
    const pos = this._stage.getPointerPosition()
    if (pos) {
      ctx.pos = this._ws.coord.convertScreenCoord(pos)
    }

    return ctx
  }

  _onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    // Only the primary (left) button starts drags/connections — right-click
    // is reserved for the context menu, middle-click is ignored.
    if (e.evt.button !== 0) return

    const target = e.target as Konva.Node

    if (target.name() === ELEMENT_TYPE.JOINT) {
      const info = getJointInfo(target)
      if (info) {
        this._startConnecting(info.handleKey, info.nodeId)
        return
      }
    }

    const resizeGrip = target.findAncestor(
      (n: Konva.Node) => n.name() === NODE_SHAPE.RESIZE,
    )
    if (resizeGrip) {
      const nodeGroup = resizeGrip.findAncestor(
        (n: Konva.Node) => n.name() === ELEMENT_TYPE.NODE,
      )
      const nodeId = Number(nodeGroup?.getAttr(ATTR.ELEMENT_ID))
      if (nodeId) {
        if (
          this._ws.state.activeType !== ActiveType.Node ||
          !this._ws.isActive(nodeId)
        ) {
          this._onNodeSelect(nodeId)
        }
        this._startNodeResize(nodeId)
      }
      return
    }

    const hit = this._hitTarget(target)
    if (hit) {
      if (hit.type === ContextMenuTargetType.Node) {
        if (
          this._ws.state.activeType !== ActiveType.Node ||
          !this._ws.isActive(hit.id)
        ) {
          this._onNodeSelect(hit.id)
        }
        const name = target.name()
        if (name === NODE_SHAPE.HEADER || name === NODE_SHAPE.NAME) {
          this._startNodeDrag(hit.id)
        }
      } else {
        this._startGroupDrag(hit.id)
      }
      return
    }

    if (e.evt.shiftKey) {
      this._startSelection()
    } else {
      this._startCanvasDrag()
      this._ws.clearActiveIds()
    }
  }

  _onPointerMove = () => {
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    if (this._isConnecting) {
      this._handleConnectingMove(pos)
      return
    }

    if (this._dragType === DRAG_TYPE.NODE) {
      this._handleNodeDrag(pos)
      return
    }

    if (this._dragType === DRAG_TYPE.GROUP) {
      this._handleGroupDrag(pos)
      return
    }

    if (this._dragType === DRAG_TYPE.CANVAS) {
      this._handleCanvasDrag(pos)
      return
    }

    if (this._dragType === DRAG_TYPE.SELECTION) {
      this._handleSelectionDrag(pos)
      return
    }

    if (this._dragType === DRAG_TYPE.RESIZE) {
      this._handleNodeResize(pos)
    }
  }

  _onPointerUp = () => {
    if (this._isConnecting) {
      this._endConnecting()
    }

    if (this._dragType === DRAG_TYPE.SELECTION) {
      this._endSelection()
    }

    this._dragType = null
  }

  // -- Helpers ---

  _hitTarget(target: Konva.Node) {
    const nodeGroup = target.findAncestor(
      (n: Konva.Node) => n.name() === ELEMENT_TYPE.NODE,
    ) as Konva.Group | undefined

    if (nodeGroup) {
      const nodeId = nodeGroup.getAttr(ATTR.ELEMENT_ID)
      if (nodeId) return { type: ContextMenuTargetType.Node, id: nodeId }
    }

    const groupGroup = target.findAncestor(
      (n: Konva.Node) => n.name() === ELEMENT_TYPE.GROUP,
    ) as Konva.Group | undefined

    if (groupGroup) {
      const groupId = Number(groupGroup.getAttr(ATTR.ELEMENT_ID))
      if (groupId) return { type: ContextMenuTargetType.Group, id: groupId }
    }

    return null
  }

  // -- Connecting ---

  _startConnecting(handleKey: string, nodeId: number) {
    const node = this._ws.getNode(nodeId)
    if (!node) return

    const handle = node.getHandle(handleKey!)
    if (!handle) return

    let startHandle = handle
    if (!handle.isRight) {
      const [edge] = this._ws.queryEdges(handle.loc)
      if (edge) {
        this._ws.removeEdgeByIds(edge.id)
        startHandle = edge.start === handle ? edge.end : edge.start
      }
    }

    this._connectHandle = startHandle
    this._isConnecting = true
    this._connectTargetHandle = null

    // Keep the source joint highlighted for the whole gesture so it is clear
    // which handle the drag started from.
    setJointHighlight(startHandle, true)

    const pos = this._stage.getPointerPosition()
    if (!pos) return

    const wsPos = this._ws.coord.convertScreenCoord(pos)
    const jointPos = getJointPos(startHandle)

    this._connectionLine.show(jointPos, wsPos)
  }

  _handleConnectingMove(screenPos: { x: number; y: number }) {
    if (!this._connectHandle) return

    const wsPos = this._ws.coord.convertScreenCoord(screenPos)
    const jointPos = getJointPos(this._connectHandle)

    this._connectionLine.update(jointPos, wsPos)
    this._updateConnectHover()
  }

  /**
   * Highlight the joint under the pointer when it is compatible with the
   * source handle (same rule as `Workspace.canConnect`); otherwise clear any
   * previous hover highlight.
   */
  _updateConnectHover() {
    if (!this._connectHandle) return

    const targetHandle = this._findHandleAtPointer()
    const nextTarget =
      targetHandle && this._connectHandle.canConnectTo(targetHandle)
        ? targetHandle
        : null

    if (nextTarget === this._connectTargetHandle) return

    if (this._connectTargetHandle) {
      setJointHighlight(this._connectTargetHandle, false)
    }
    if (nextTarget) {
      setJointHighlight(nextTarget, true)
    }
    this._connectTargetHandle = nextTarget
  }

  _endConnecting() {
    this._isConnecting = false
    this._connectionLine.hide()

    if (this._connectHandle) {
      setJointHighlight(this._connectHandle, false)
    }
    if (this._connectTargetHandle) {
      setJointHighlight(this._connectTargetHandle, false)
      this._connectTargetHandle = null
    }

    if (!this._connectHandle) return

    const targetHandle = this._findHandleAtPointer()
    if (targetHandle && this._connectHandle.node.id !== targetHandle.node.id) {
      this._ws.connect(this._connectHandle, targetHandle)
    }

    this._connectHandle = null
  }

  _findHandleAtPointer(): NodeHandle | null {
    const pos = this._stage.getPointerPosition()
    if (!pos) return null

    const target = this._stage.getIntersection(pos)
    if (!target) return null

    if (target.name() !== ELEMENT_TYPE.JOINT) return null

    const info = getJointInfo(target)
    if (!info) return null

    const targetNode = this._ws.getNode(info.nodeId)
    if (!targetNode) return null

    return targetNode.getHandle(info.handleKey!) ?? null
  }

  // --- Node Drag ---

  _startNodeDrag(nodeId: number) {
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    this._dragType = DRAG_TYPE.NODE
    this._dragNodeId = nodeId
    this._dragLastPos = { x: pos.x, y: pos.y }
  }

  _handleNodeDrag(screenPos: { x: number; y: number }) {
    const dx = screenPos.x - this._dragLastPos.x
    const dy = screenPos.y - this._dragLastPos.y

    this._dragLastPos = { x: screenPos.x, y: screenPos.y }

    const wsDelta = {
      x: dx / this._ws.coord.scale,
      y: dy / this._ws.coord.scale,
    }

    if (
      this._ws.state.activeType === ActiveType.Node &&
      this._ws.state.activeIds.length > 1
    ) {
      this._ws.moveActiveNodes(wsDelta)
    } else {
      const node = this._ws.getNode(this._dragNodeId)
      if (node) {
        node.move(wsDelta.x, wsDelta.y)
      }
    }
  }

  // --- Node Resize ---

  _startNodeResize(nodeId: number) {
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    this._dragType = DRAG_TYPE.RESIZE
    this._dragNodeId = nodeId
    this._dragLastPos = { x: pos.x, y: pos.y }
  }

  _handleNodeResize(screenPos: { x: number; y: number }) {
    const node = this._ws.getNode(this._dragNodeId)
    if (!node) return

    const dx = (screenPos.x - this._dragLastPos.x) / this._ws.coord.scale
    const dy = (screenPos.y - this._dragLastPos.y) / this._ws.coord.scale
    this._dragLastPos = { x: screenPos.x, y: screenPos.y }

    node.setSize({
      // Baseline from the effective width so an auto-width node doesn't jump
      // straight to the minimum when the first drag goes left.
      x: Math.max(NODE_MIN_WIDTH, getNodeWidth(node) + dx),
      // Baseline from the effective height: an auto-height node (`size.y` = 0)
      // renders at its content height, so without this the first ~content
      // height pixels of downward drag would produce no visible change. The
      // renderer still clamps the body so it never shrinks below content.
      y: Math.max(0, getNodeHeight(node) + dy),
    })
  }

  // --- Group Drag ---

  _startGroupDrag(groupId: number) {
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    const group = this._ws.groups.find((g) => g.id === groupId)
    if (!group) return

    this._dragType = DRAG_TYPE.GROUP
    this._dragGroupId = groupId
    this._dragLastPos = { x: pos.x, y: pos.y }

    this._ws.setActiveIds(ActiveType.Group, [groupId])
  }

  _handleGroupDrag(screenPos: { x: number; y: number }) {
    const dx = screenPos.x - this._dragLastPos.x
    const dy = screenPos.y - this._dragLastPos.y

    this._dragLastPos = { x: screenPos.x, y: screenPos.y }

    const group = this._ws.groups.find((g) => g.id === this._dragGroupId)
    if (group) {
      group.move({
        x: dx / this._ws.coord.scale,
        y: dy / this._ws.coord.scale,
      })
    }
  }

  // --- Canvas Pan ---

  _startCanvasDrag() {
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    this._dragType = DRAG_TYPE.CANVAS
    this._dragLastPos = { x: pos.x, y: pos.y }
  }

  _handleCanvasDrag(screenPos: { x: number; y: number }) {
    const dx = screenPos.x - this._dragLastPos.x
    const dy = screenPos.y - this._dragLastPos.y

    this._dragLastPos = { x: screenPos.x, y: screenPos.y }

    this._ws.coord.move(dx, dy)
  }

  // --- Rubber-band Selection ---

  _startSelection() {
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    this._dragType = DRAG_TYPE.SELECTION
    this._selectionStarted = true
    this._selectionX1 = pos.x
    this._selectionY1 = pos.y

    if (!this._selectionRect) {
      this._selectionRect = new Konva.Rect({
        fill: COLORS.SELECTION_FILL,
        stroke: COLORS.SELECTION_BORDER,
        strokeWidth: 1,
        listening: false,
        visible: false,
      })
      this._nodeLayer.add(this._selectionRect)
    }
  }

  _handleSelectionDrag(screenPos: { x: number; y: number }) {
    if (!this._selectionRect) return

    const x = Math.min(this._selectionX1, screenPos.x)
    const y = Math.min(this._selectionY1, screenPos.y)
    const w = Math.abs(this._selectionX1 - screenPos.x)
    const h = Math.abs(this._selectionY1 - screenPos.y)

    // Convert from screen coords to stage-local coords so the rect renders
    // at the correct position when the stage has a transform applied.
    const stage = this._stage
    const localX = (x - stage.x()) / stage.scaleX()
    const localY = (y - stage.y()) / stage.scaleY()
    const localW = w / stage.scaleX()
    const localH = h / stage.scaleY()

    this._selectionRect.x(localX)
    this._selectionRect.y(localY)
    this._selectionRect.width(localW)
    this._selectionRect.height(localH)
    this._selectionRect.visible(true)
    this._selectionRect.getLayer()?.batchDraw()
  }

  _endSelection() {
    if (!this._selectionRect || !this._selectionStarted) return

    this._selectionStarted = false
    this._selectionRect.visible(false)
    this._selectionRect.getLayer()?.batchDraw()

    const selRect = this._selectionRect
    // After the fix in _handleSelectionDrag, selRect position is in stage-local
    // coords which equal convertScreenCoord(screenPos), i.e. workspace coords.
    const tl = { x: selRect.x(), y: selRect.y() }
    const br = {
      x: selRect.x() + selRect.width(),
      y: selRect.y() + selRect.height(),
    }

    const selectedNodeIds: number[] = []
    for (const node of this._ws.nodes) {
      if (
        node.pos.x >= tl.x &&
        node.pos.y >= tl.y &&
        node.pos.x + getNodeWidth(node) <= br.x &&
        node.pos.y + getNodeHeight(node) <= br.y
      ) {
        selectedNodeIds.push(node.id)
      }
    }

    this._ws.setActiveIds(ActiveType.Node, selectedNodeIds)
  }

  // --- Zoom ---

  _onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    const coord = this._ws.coord
    const scaleStep = getZoomStep(coord.scale)
    let scale = coord.scale + (e.evt.deltaY < 0 ? 1 : -1) * scaleStep
    scale = clamp(scale, ZOOM_MIN, ZOOM_MAX)

    coord.zoomAt(pos, scale)
  }

  dispose() {
    // Remove only the listeners registered by this instance.
    this._stage.off('pointerdown', this._onPointerDown)
    this._stage.off('pointermove', this._onPointerMove)
    this._stage.off('pointerup', this._onPointerUp)
    this._stage.off('wheel', this._onWheel)
    this._stage.off('contextmenu', this._onContextMenuEvent)
    this._connectionLine.destroy()
  }
}

function getJointInfo(target: Konva.Node) {
  const targetName = target.name()
  if (targetName !== ELEMENT_TYPE.JOINT) {
    return null
  }

  const handleKey = target
    .findAncestor((n: Konva.Node) => n.name() === ELEMENT_TYPE.HANDLE)
    ?.getAttr(ATTR.ELEMENT_ID)

  const nodeId = target
    .findAncestor((n: Konva.Node) => n.name() === ELEMENT_TYPE.NODE)
    ?.getAttr(ATTR.ELEMENT_ID)

  if (handleKey == null || nodeId == null) {
    return null
  }

  return {
    nodeId: nodeId as number,
    handleKey: handleKey as string,
  }
}
