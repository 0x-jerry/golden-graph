import Konva from 'konva'
import { clamp } from '@0x-jerry/utils'
import type { NodeHandle, Workspace } from '../core'
import { ActiveType, HandlePosition } from '../core'
import { ConnectionLine } from './ConnectionLine'
import {
  COLORS,
  LAYOUT,
  NODE_PREFIX,
  GROUP_PREFIX,
  JOINT_PREFIX,
  JOINT_REGEX,
  DRAG_TYPE,
  NODE_BODY_PADDING,
  ZOOM_MIN,
  ZOOM_MAX,
} from './constants'

export interface InteractionManagerOptions {
  stage: Konva.Stage
  ws: Workspace
  edgeLayer: Konva.Layer
  onNodeSelect: (id: number) => void
}

export class InteractionManager {
  _stage: Konva.Stage
  _ws: Workspace
  _connectionLine: ConnectionLine

  _dragType: string | null = null
  _dragNodeId = 0
  _dragGroupId = 0
  _dragLastPos = { x: 0, y: 0 }

  _isConnecting = false
  _connectHandle: NodeHandle | null = null

  _selectionStarted = false
  _selectionX1 = 0
  _selectionY1 = 0
  _selectionRect: Konva.Rect | null = null

  _disposers: (() => void)[] = []

  _onNodeSelect: (id: number) => void

  constructor(opts: InteractionManagerOptions) {
    this._stage = opts.stage
    this._ws = opts.ws
    this._connectionLine = new ConnectionLine(opts.edgeLayer)
    this._onNodeSelect = opts.onNodeSelect
    this._setupStageEvents()
    this._setupKeyboardEvents()
  }

  _setupStageEvents() {
    const stage = this._stage

    stage.on('pointerdown', (e) => {
      this._onPointerDown(e)
    })

    stage.on('pointermove', () => {
      this._onPointerMove()
    })

    stage.on('pointerup', () => {
      this._onPointerUp()
    })

    stage.on('wheel', (e) => {
      this._onWheel(e)
    })

    stage.on('contextmenu', (e) => {
      e.evt.preventDefault()
    })
  }

  _setupKeyboardEvents() {
    const onKeyDown = (e: KeyboardEvent) => {
      this._ws.interactive._state.shift = e.shiftKey
    }
    const onKeyUp = (e: KeyboardEvent) => {
      this._ws.interactive._state.shift = e.shiftKey
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)

    this._disposers.push(() => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
    })
  }

  _onPointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    const target = e.target
    const targetName = target.name()

    if (targetName.startsWith(JOINT_PREFIX)) {
      this._startConnecting(targetName)
      return
    }

    const nodeGroup = target.findAncestor((n: Konva.Node) =>
      n.name().startsWith(NODE_PREFIX),
    ) as Konva.Group | undefined
    if (nodeGroup) {
      const nodeId = Number(nodeGroup.getAttr('nodeId'))
      if (nodeId) {
        this._onNodeSelect(nodeId)
        this._startNodeDrag(nodeId, e)
        return
      }
    }

    const groupGroup = target.findAncestor((n: Konva.Node) =>
      n.name().startsWith(GROUP_PREFIX),
    ) as Konva.Group | undefined
    if (groupGroup) {
      const groupId = Number(groupGroup.getAttr('groupId'))
      if (groupId) {
        this._startGroupDrag(groupId)
        return
      }
    }

    if (e.evt.shiftKey) {
      this._startSelection()
    } else {
      this._startCanvasDrag()
      this._ws.clearActiveIds()
    }
  }

  _onPointerMove() {
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
  }

  _onPointerUp() {
    if (this._isConnecting) {
      this._endConnecting()
    }

    if (this._dragType === DRAG_TYPE.SELECTION) {
      this._endSelection()
    }

    this._dragType = null
  }

  // -- Connecting ---

  _startConnecting(targetName: string) {
    const match = targetName.match(JOINT_REGEX)
    if (!match) return

    const nodeId = Number(match[1])
    const handleKey = match[2]

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

    const pos = this._stage.getPointerPosition()
    if (!pos) return

    const wsPos = this._ws.coord.convertScreenCoord(pos)
    const jointPos = this._getHandlePos(startHandle)

    this._connectionLine.show(jointPos, wsPos)
  }

  _handleConnectingMove(screenPos: { x: number; y: number }) {
    if (!this._connectHandle) return

    const wsPos = this._ws.coord.convertScreenCoord(screenPos)
    const jointPos = this._getHandlePos(this._connectHandle)

    this._connectionLine.update(jointPos, wsPos)
  }

  _endConnecting() {
    this._isConnecting = false
    this._connectionLine.hide()

    if (!this._connectHandle) return

    const pos = this._stage.getPointerPosition()
    if (!pos) {
      this._connectHandle = null
      return
    }

    const target = this._stage.getIntersection(pos)
    if (!target) {
      this._connectHandle = null
      return
    }

    const targetName = target.name()
    if (!targetName || !targetName.startsWith(JOINT_PREFIX)) {
      this._connectHandle = null
      return
    }

    const match = targetName.match(JOINT_REGEX)
    if (!match) {
      this._connectHandle = null
      return
    }

    const targetNodeId = Number(match[1])
    const targetKey = match[2]

    const targetNode = this._ws.getNode(targetNodeId)
    if (!targetNode) {
      this._connectHandle = null
      return
    }

    const targetHandle = targetNode.getHandle(targetKey!)
    if (!targetHandle) {
      this._connectHandle = null
      return
    }

    if (this._connectHandle.node.id !== targetHandle.node.id) {
      this._ws.connect(this._connectHandle, targetHandle)
    }

    this._connectHandle = null
  }

  // --- Node Drag ---

  _startNodeDrag(nodeId: number, _e: Konva.KonvaEventObject<PointerEvent>) {
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
      this._stage.getLayers()[0]?.add(this._selectionRect)
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
        node.pos.x + LAYOUT.NODE_WIDTH <= br.x &&
        node.pos.y +
          LAYOUT.HEADER_HEIGHT +
          node.handles.length * LAYOUT.HANDLE_ROW_HEIGHT +
          NODE_BODY_PADDING <=
          br.y
      ) {
        selectedNodeIds.push(node.id)
      }
    }

    this._ws.setActiveIds(ActiveType.Node, selectedNodeIds)
  }

  // --- Zoom ---

  _onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    const coord = this._ws.coord
    const scaleStep = coord.scale > 1 ? 0.05 : coord.scale > 0.1 ? 0.025 : 0.01
    let scale = coord.scale + (e.evt.deltaY < 0 ? 1 : -1) * scaleStep
    scale = clamp(scale, ZOOM_MIN, ZOOM_MAX)

    coord.zoomAt(pos, scale)
  }

  // --- Helpers ---

  _getHandlePos(handle: NodeHandle): { x: number; y: number } {
    const handles = handle.node.handles.filter(
      (h) => h.position !== HandlePosition.None,
    )
    const index = handles.indexOf(handle)
    const y =
      handle.node.pos.y +
      LAYOUT.HEADER_HEIGHT +
      index * LAYOUT.HANDLE_ROW_HEIGHT +
      LAYOUT.HANDLE_ROW_HEIGHT / 2

    if (handle.isRight) {
      return { x: handle.node.pos.x + LAYOUT.NODE_WIDTH, y }
    }
    return { x: handle.node.pos.x, y }
  }

  dispose() {
    this._stage.off()
    this._connectionLine.destroy()
    this._disposers.forEach((d) => d())
    this._disposers = []
  }
}
