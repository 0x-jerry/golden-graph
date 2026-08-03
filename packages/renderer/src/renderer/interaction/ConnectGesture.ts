import type { NodeHandle, IVec2 } from '@0x-jerry/golden-graph'
import { ConnectionLine } from '../ConnectionLine'
import { getJointPos } from '../EdgeView'
import { setJointHighlight } from '../HandleView'
import { ELEMENT_TYPE, LAYER_NAME } from '../constants'
import { getJointInfo } from './hitTest'
import type { GestureContext } from './types'

export class ConnectGesture {
  _connectionLine = new ConnectionLine()
  _connectHandle: NodeHandle | null = null
  _connectTargetHandle: NodeHandle | null = null
  _ctx: GestureContext

  constructor(_ctx: GestureContext) {
    this._ctx = _ctx
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

    // Keep the source joint highlighted for the whole gesture so it is clear
    // which handle the drag started from.
    setJointHighlight(startHandle, true)

    const pos = this._ctx.stage.getPointerPosition()
    if (!pos) return

    const wsPos = this._ctx.ws.coord.convertScreenCoord(pos)
    const jointPos = getJointPos(startHandle)

    this._connectionLine.update(jointPos, wsPos)
    this._connectionLine.show()
    this._render()
  }

  move(screenPos: IVec2) {
    if (!this._connectHandle) return

    const wsPos = this._ctx.ws.coord.convertScreenCoord(screenPos)
    const jointPos = getJointPos(this._connectHandle)

    this._connectionLine.update(jointPos, wsPos)
    this._render()
    this._updateHover()
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

    const targetHandle = this._findHandleAtPointer()
    if (targetHandle && this._connectHandle.node.id !== targetHandle.node.id) {
      this._ctx.ws.connect(this._connectHandle, targetHandle)
    }

    this._connectHandle = null
  }

  dispose() {
    this._connectionLine.destroy()
  }

  /**
   * Highlight the joint under the pointer when it is compatible with the
   * source handle (same rule as `Workspace.canConnect`); otherwise clear any
   * previous hover highlight.
   */
  _updateHover() {
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

  _findHandleAtPointer(): NodeHandle | null {
    const pos = this._ctx.stage.getPointerPosition()
    if (!pos) return null

    const target = this._ctx.stage.getIntersection(pos)
    if (!target) return null
    if (target.name() !== ELEMENT_TYPE.JOINT) return null

    const info = getJointInfo(target)
    if (!info) return null

    const node = this._ctx.ws.getNode(info.nodeId)
    if (!node) return null

    return node.getHandle(info.handleKey) ?? null
  }

  _render() {
    this._ctx.renderOverlay(this._connectionLine, LAYER_NAME.EDGES)
  }
}
