import { getNodeHandleDom } from './dom'
import { HandlePosition } from './HandlePosition'
import { isIntersected } from './helper'
import type { Node } from './Node'
import type { INodeHandle, INodeHandleLoc } from './types'

export enum NodeHandleType {
  All = '*',
}

export class NodeHandle {
  type: string[] = [NodeHandleType.All]

  key = ''

  name = 'Default Handle'

  position = HandlePosition.None

  _node?: Node

  get loc(): INodeHandleLoc {
    return {
      id: this.node.id,
      key: this.key,
    }
  }

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

  /**
   * Absolute position
   */
  getJointDomPosition() {
    const dom = this.getJointDom()
    if (!dom) {
      throw new Error('Can not find joint dom element!')
    }

    const pos = {
      x: this.node.pos.x + dom.offsetLeft + dom.clientWidth / 2,
      y: this.node.pos.y + dom.offsetTop + dom.clientHeight / 2,
    }

    return pos
  }

  setNode(node: Node) {
    this._node = node
  }

  canConnectTo(handle: NodeHandle): boolean {
    if (this.position === handle.position) {
      return false
    }

    if (includeTypeAll(this.type) || includeTypeAll(handle.type)) {
      return true
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

function includeTypeAll(types: string[]) {
  return types.includes(NodeHandleType.All)
}
