import { getNodeHandleDom } from './dom'
import { HandlePosition } from './HandlePosition'
import { isIntersected } from './helper'
import type { Node } from './Node'
import type { INodeHandle } from './types'

export class NodeHandle {
  type: string[] = ['*']

  key = ''

  name = 'Default Handle'

  position = HandlePosition.None

  _node?: Node

  get isOutput() {
    return this.position === HandlePosition.Right
  }

  get isInput() {
    return this.position === HandlePosition.Left
  }

  get node() {
    if (!this._node) {
      throw new Error('Node is not set')
    }

    return this._node
  }

  getDom() {
    const nodeId = this.node.id
    const wsId = this.node.workspace.id

    return getNodeHandleDom(wsId, nodeId, this.key)
  }

  getJointDom() {
    return this.getDom()?.querySelector(`[role="handle-joint"]`) as
      | HTMLElement
      | null
      | undefined
  }

  setNode(node: Node) {
    this._node = node
  }

  canConnectTo(handle: NodeHandle): boolean {
    if (this.position === handle.position) {
      return false
    }

    return isIntersected(this.type, handle.type)
  }

  fromConfig(data: INodeHandle): void {
    this.key = data.key
    this.name = data.name
    this.type = data.type
    this.position = data.position
  }
}
