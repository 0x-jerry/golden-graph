import type Konva from 'konva'
import { clamp, EventEmitter } from '@0x-jerry/utils'
import type { Workspace } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import type { ContextMenuContext, CoreMenuItem } from '../types'
import { ContextMenuTargetType } from '../types'
import {
  ATTR,
  ELEMENT_TYPE,
  NODE_SHAPE,
  ZOOM_MAX,
  ZOOM_MIN,
  getZoomStep,
} from '../constants'
import { CanvasPanGesture } from './CanvasPanGesture'
import { ConnectGesture } from './ConnectGesture'
import { ContextMenuController } from './ContextMenuController'
import { GroupDragGesture } from './GroupDragGesture'
import { GroupResizeGesture } from './GroupResizeGesture'
import { getJointInfo, hitTarget } from './hitTest'
import { NodeDragGesture } from './NodeDragGesture'
import { NodeResizeGesture } from './NodeResizeGesture'
import { SelectionGesture } from './SelectionGesture'
import type { GestureContext, IGesture, OverlayLayer } from './types'
import { syncGroupMembership } from '../groupMembership'

export type InteractionManagerEvents = {
  'node-select': [id: number]
  'node-dblclick': [id: number]
  'context-menu': [
    ctx: ContextMenuContext,
    evt: PointerEvent,
    menus: CoreMenuItem[],
  ]
  /**
   * The caller must add the shape to the layer it owns and redraw it —
   * resolving layers is the caller's responsibility.
   */
  'overlay-render': [
    target: { shape: Konva.Group | Konva.Shape; layer: OverlayLayer },
  ]
}

export interface InteractionManagerOptions {
  stage: Konva.Stage
  ws: Workspace
  /**
   * Screen-pixel radius that auto-targets a joint during a connection drag.
   * `0` disables proximity so only exact pointer hits connect.
   */
  proximityRadius?: number
}

export class InteractionManager extends EventEmitter<InteractionManagerEvents> {
  _stage: Konva.Stage
  _ws: Workspace
  _activeGesture: IGesture | null = null

  _connect: ConnectGesture
  _nodeDrag: NodeDragGesture
  _nodeResize: NodeResizeGesture
  _groupDrag: GroupDragGesture
  _groupResize: GroupResizeGesture
  _canvasPan: CanvasPanGesture
  _selection: SelectionGesture
  _contextMenu: ContextMenuController

  constructor(opts: InteractionManagerOptions) {
    super()
    this._stage = opts.stage
    this._ws = opts.ws

    const ctx: GestureContext = {
      stage: this._stage,
      ws: this._ws,
      renderOverlay: (shape, layer) =>
        this.emit('overlay-render', { shape, layer }),
    }

    this._connect = new ConnectGesture(ctx, opts.proximityRadius)
    this._nodeDrag = new NodeDragGesture(ctx)
    this._nodeResize = new NodeResizeGesture(ctx)
    this._groupDrag = new GroupDragGesture(ctx)
    this._groupResize = new GroupResizeGesture(ctx)
    this._canvasPan = new CanvasPanGesture(ctx)
    this._selection = new SelectionGesture(ctx)
    this._contextMenu = new ContextMenuController({
      stage: this._stage,
      ws: this._ws,
      onNodeSelect: (id) => this.emit('node-select', id),
      onContextMenu: (ctx, evt, menus) =>
        this.emit('context-menu', ctx, evt, menus),
    })

    this._setupStageEvents()
  }

  _setupStageEvents() {
    const stage = this._stage
    stage.on('pointerdown', this._onPointerDown)
    stage.on('pointermove', this._onPointerMove)
    stage.on('pointerup', this._onPointerUp)
    stage.on('wheel', this._onWheel)
    stage.on('contextmenu', this._onContextMenuEvent)
    stage.on('dblclick', this._onDblClick)
  }

  _onDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const hit = hitTarget(e.target)
    if (hit?.type === ContextMenuTargetType.Node) {
      this.emit('node-dblclick', hit.id)
    }
  }

  _onContextMenuEvent = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault()
    this._contextMenu.handle(e)
  }

  _onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    // Only the primary (left) button starts drags/connections — right-click
    // is reserved for the context menu, middle-click is ignored.
    if (e.evt.button !== 0) return

    const target = e.target as Konva.Node

    if (target.name() === ELEMENT_TYPE.JOINT) {
      const info = getJointInfo(target)
      if (info) {
        this._connect.start(info.handleKey, info.nodeId)
        this._activeGesture = this._connect
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
          this.emit('node-select', nodeId)
        }
        this._nodeResize.start(nodeId)
        this._activeGesture = this._nodeResize
        return
      }

      const groupGroup = resizeGrip.findAncestor(
        (n: Konva.Node) => n.name() === ELEMENT_TYPE.GROUP,
      )
      const groupId = Number(groupGroup?.getAttr(ATTR.ELEMENT_ID))
      if (groupId) {
        this._groupResize.start(groupId)
        this._activeGesture = this._groupResize
        return
      }
    }

    const hit = hitTarget(target)
    if (hit) {
      if (hit.type === ContextMenuTargetType.Node) {
        if (
          this._ws.state.activeType !== ActiveType.Node ||
          !this._ws.isActive(hit.id)
        ) {
          this.emit('node-select', hit.id)
        }
        const name = target.name()
        if (name === NODE_SHAPE.HEADER || name === NODE_SHAPE.NAME) {
          this._nodeDrag.start(hit.id)
          this._activeGesture = this._nodeDrag
        }
      } else {
        this._groupDrag.start(hit.id)
        this._activeGesture = this._groupDrag
      }
      return
    }

    if (e.evt.shiftKey) {
      this._selection.start()
      this._activeGesture = this._selection
    } else {
      this._canvasPan.start()
      this._activeGesture = this._canvasPan
      this._ws.clearActiveIds()
    }
  }

  _onPointerMove = () => {
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    this._activeGesture?.move(pos)
  }

  _onPointerUp = () => {
    this._activeGesture?.end()
    this._activeGesture = null
    syncGroupMembership(this._ws)
  }

  _onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const pos = this._stage.getPointerPosition()
    if (!pos) return

    const coord = this._ws.coord
    const scaleStep = getZoomStep(coord.scale)
    const scale = clamp(
      coord.scale + (e.evt.deltaY < 0 ? 1 : -1) * scaleStep,
      ZOOM_MIN,
      ZOOM_MAX,
    )

    coord.zoomAt(pos, scale)
  }

  dispose() {
    // Remove only the listeners registered by this instance.
    this._stage.off('pointerdown', this._onPointerDown)
    this._stage.off('pointermove', this._onPointerMove)
    this._stage.off('pointerup', this._onPointerUp)
    this._stage.off('wheel', this._onWheel)
    this._stage.off('contextmenu', this._onContextMenuEvent)
    this._stage.off('dblclick', this._onDblClick)
    this._connect.dispose()
    this.off()
  }
}
