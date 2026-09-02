import type { NodeHandle, IVec2 } from '@0x-jerry/golden-graph'
import { ConnectionLine } from '../ConnectionLine'
import { getJointPos } from '../EdgeView'
import { setJointHighlight } from '../HandleView'
import { ELEMENT_TYPE, LAYER_NAME, PROXIMITY_RADIUS } from '../constants'
import { getJointInfo } from './hitTest'
import type { GestureContext, IGesture } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

export class ConnectGesture implements IGesture {
  _connectionLine: ConnectionLine
  _connectHandle: NodeHandle | null = null
  _connectTargetHandle: NodeHandle | null = null
  _ctx: GestureContext
  /**
   * Screen-pixel radius around a joint that auto-targets it during the drag.
   * `0` disables proximity so only exact pointer hits connect.
   */
  _proximityRadius: number
  /** Candidate joints (all positioned handles on other nodes), built at start. */
  _candidates: NodeHandle[] = []

  constructor(
    _ctx: GestureContext,
    proximityRadius = PROXIMITY_RADIUS,
    theme: GraphTheme = DEFAULT_THEME,
  ) {
    this._ctx = _ctx
    this._proximityRadius = proximityRadius
    this._connectionLine = new ConnectionLine(theme)
  }

  applyTheme(theme: GraphTheme): void {
    this._connectionLine.applyTheme(theme)
  }

  start(handleKey: string, nodeId: number) {
    const node = this._ctx.ws.getNode(nodeId)
    if (!node) return

    const handle = node.getHandle(handleKey)
    if (!handle) return

    let startHandle = handle
    if (!handle.isRight) {
      const [edge] = this._ctx.ws.queryEdges(handle.loc)
      if (edge) {
        this._ctx.ws.removeEdgeByIds(edge.id)
        startHandle = edge.start === handle ? edge.end : edge.start
      }
    }

    this._connectHandle = startHandle
    this._connectTargetHandle = null
    this._candidates = this._ctx.ws.nodes
      .filter((node) => node.id !== startHandle.node.id)
      .flatMap((node) =>
        node.handles.filter((handle) => handle.isLeft || handle.isRight),
      )

    // Keep the source joint highlighted for the whole gesture so it is clear
    // which handle the drag started from.
    setJointHighlight(startHandle, true)

    const pos = this._ctx.stage.getPointerPosition()
    if (!pos) return

    const wsPos = this._ctx.ws.coord.convertScreenCoord(pos)

    this._connectionLine.update(startHandle, wsPos)
    this._connectionLine.show()
    this._render()
  }

  move(screenPos: IVec2) {
    if (!this._connectHandle) return

    const target = this._updateHover(screenPos)
    const wsPos = target
      ? getJointPos(target)
      : this._ctx.ws.coord.convertScreenCoord(screenPos)

    this._connectionLine.update(this._connectHandle, wsPos)
    this._render()
  }

  end() {
    this._connectionLine.hide()
    this._render()

    if (this._connectHandle) {
      setJointHighlight(this._connectHandle, false)
    }
    if (this._connectTargetHandle) {
      setJointHighlight(this._connectTargetHandle, false)
      this._connectTargetHandle = null
    }

    if (!this._connectHandle) return

    const pos = this._ctx.stage.getPointerPosition()
    const targetHandle = pos ? this._findTargetHandle(pos) : null
    if (targetHandle && this._connectHandle.node.id !== targetHandle.node.id) {
      this._ctx.ws.connect(this._connectHandle, targetHandle)
    }

    this._connectHandle = null
  }

  dispose() {
    this._connectionLine.destroy()
  }

  /**
   * Highlight the joint targeted by the pointer when it is compatible with the
   * source handle (same rule as `Workspace.canConnect`); otherwise clear any
   * previous hover highlight. A joint is targeted either by an exact hit or by
   * proximity within `_proximityRadius` screen pixels.
   */
  _updateHover(screenPos: IVec2): NodeHandle | null {
    if (!this._connectHandle) return null

    const targetHandle = this._findTargetHandle(screenPos)
    const nextTarget =
      targetHandle && this._connectHandle.canConnectTo(targetHandle)
        ? targetHandle
        : null

    if (nextTarget === this._connectTargetHandle) return nextTarget

    if (this._connectTargetHandle) {
      setJointHighlight(this._connectTargetHandle, false)
    }
    if (nextTarget) {
      setJointHighlight(nextTarget, true)
    }
    this._connectTargetHandle = nextTarget
    return nextTarget
  }

  /**
   * Resolve the handle a release should connect to. An exact joint hit takes
   * priority: a compatible one is targeted, an incompatible one blocks the
   * fallback so the user can't accidentally connect to a nearby joint while
   * aiming at a specific one. Only when the pointer is not on any joint does
   * the nearest compatible joint within the proximity radius apply.
   */
  _findTargetHandle(screenPos: IVec2): NodeHandle | null {
    const exact = this._findHandleAtPointer(screenPos)
    if (exact) {
      return this._connectHandle?.canConnectTo(exact) ? exact : null
    }
    return this._findHandleInProximity(screenPos)
  }

  _findHandleAtPointer(screenPos: IVec2): NodeHandle | null {
    const target = this._ctx.stage.getIntersection(screenPos)
    if (!target) return null
    if (target.name() !== ELEMENT_TYPE.JOINT) return null

    const info = getJointInfo(target)
    if (!info) return null

    const node = this._ctx.ws.getNode(info.nodeId)
    if (!node) return null

    return node.getHandle(info.handleKey) ?? null
  }

  /**
   * Nearest compatible joint whose joint center is within `_proximityRadius`
   * screen pixels of the pointer — lets users connect without aiming exactly
   * at the small joint. Returns `null` when disabled or nothing is in range.
   */
  _findHandleInProximity(screenPos: IVec2): NodeHandle | null {
    const source = this._connectHandle
    if (!source || this._proximityRadius <= 0) return null

    const radiusSq = this._proximityRadius * this._proximityRadius
    let best: NodeHandle | null = null
    let bestDistSq = Infinity

    for (const handle of this._candidates) {
      // Candidates are snapshotted at `start()`; skip any whose node was
      // removed mid-drag (e.g. by a completing run).
      if (!this._ctx.ws.getNode(handle.node.id)) continue
      if (!source.canConnectTo(handle)) continue

      const jointPos = this._ctx.ws.coord.convertToScreenCoord(
        getJointPos(handle),
      )
      const dx = screenPos.x - jointPos.x
      const dy = screenPos.y - jointPos.y
      const distSq = dx * dx + dy * dy

      if (distSq <= radiusSq && distSq < bestDistSq) {
        best = handle
        bestDistSq = distSq
      }
    }

    return best
  }

  _render() {
    this._ctx.renderOverlay(this._connectionLine, LAYER_NAME.EDGES)
  }
}
