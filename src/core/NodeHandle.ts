import type { Optional } from '@0x-jerry/utils'
import { getNodeHandleDom } from './dom'
import { HandlePosition } from './HandlePosition'
import { isIntersected } from './helper'
import type { Node } from './Node'
import type { INodeHandleLoc, ObjectAny } from './types'

export enum NodeHandleType {
  All = '*',
}

export interface INodeHandleConfigOptions {
  [key: string]: any

  type: string
}

export interface INodeHandleConfig {
  key?: string
  type?: string[]

  name?: string

  position?: HandlePosition

  /**
   * Accept multiple connections, only for left handle
   */
  multiple?: boolean

  options?: INodeHandleConfigOptions
}

export class NodeHandle {
  types: string[] = [NodeHandleType.All]

  key = ''

  name = 'Default Handle'

  position = HandlePosition.None

  /**
   * Accept multiple connections, only for left handle
   */
  multiple = false

  _options: ObjectAny = {}

  _node?: Node

  get loc(): INodeHandleLoc {
    return {
      id: this.node.id,
      key: this.key,
    }
  }

  get isRight() {
    return this.position === HandlePosition.Right
  }

  get isLeft() {
    return this.position === HandlePosition.Left
  }

  get isNone() {
    return this.position === HandlePosition.None
  }

  get node() {
    if (!this._node) {
      throw new Error('Node is not set')
    }

    return this._node
  }

  is(loc: INodeHandleLoc) {
    const l = this.loc
    return l.id === loc.id && l.key === loc.key
  }

  getOptions<T extends INodeHandleConfigOptions = INodeHandleConfigOptions>() {
    return this._options as Readonly<T>
  }

  getValue<T>(): T | undefined {
    return this.node.getData(this.key)
  }

  setValue(value: unknown, opt: { skipEvent?: boolean } = {}) {
    this.node.setData(this.key, value)

    if (!opt.skipEvent) {
      this.node.workspace.events.emit('handle:updated', this)
    }
  }

  getDom() {
    const nodeId = this.node.id
    const wsId = this.node.workspace.id

    return getNodeHandleDom(wsId, nodeId, this.key)
  }

  getJointDom() {
    return this.getDom()?.querySelector(
      `[role="handle-joint"]`,
    ) as Optional<HTMLElement>
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

    if (this.node === handle.node) {
      return false
    }

    if (includeTypeAll(this.types) || includeTypeAll(handle.types)) {
      return true
    }

    return isIntersected(this.types, handle.types)
  }

  fromConfig(data: INodeHandleConfig): void {
    this.key = data.key ?? ''
    this.name = data.name ?? ''
    this.types = data.type ?? []
    this.position = data.position ?? HandlePosition.None

    Object.assign(this._options, data.options)
  }
}

function includeTypeAll(types: string[]) {
  return types.includes(NodeHandleType.All)
}
