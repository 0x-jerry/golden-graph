import { ensureArray } from '@0x-jerry/utils'
import {
  HandlePosition,
  type INodeHandleConfig,
  type INodeHandleConfigOptions,
  type INodeHandleLoc,
} from '@0x-jerry/golden-graph-protocol'
import { isIntersected, toReadonly } from './helper'
import type { Node } from './Node'
import type { ObjectAny } from './types'

export enum NodeHandleType {
  All = '*',
}

export class NodeHandle {
  accepts: string[] = [NodeHandleType.All]

  type = ''

  key = ''

  name = 'Default Handle'

  description = ''

  position = HandlePosition.None

  _options: ObjectAny = {}

  _node?: Node

  _connectedHandle?: NodeHandle

  _value?: unknown

  get connectedHandle() {
    return toReadonly(this._connectedHandle)
  }

  get isConnected() {
    return !!this._connectedHandle
  }

  get loc() {
    return toReadonly({
      id: this.node.id,
      key: this.key,
    })
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

  /**
   * Get value of handle.
   * If handle is left, return value of connected handle.
   * @returns
   */
  getValue(): unknown {
    if (this.isLeft && this.connectedHandle) {
      return this.connectedHandle.getValue()
    }

    return this._value
  }

  /**
   * Set real value of handle.
   * @param value
   * @returns
   */
  setValue(value: unknown) {
    if (this._value === value) {
      return
    }

    this._value = value

    this.node.workspace.events.emit('handle:updated', this)
  }

  /**
   * Set value directly without emitting event.
   * @internal
   *
   * @param value
   */
  setInitialValue(value: unknown) {
    this._value = value
  }

  /**
   * Get real value of handle.
   * @internal
   *
   * @returns
   */
  getRealValue() {
    return this._value
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

    if (includeAcceptAll(this.accepts) || includeAcceptAll(handle.accepts)) {
      return true
    }

    return isIntersected(this.accepts, handle.accepts)
  }

  setConnectedHandle(handle?: NodeHandle) {
    this._connectedHandle = handle
    this.node.workspace.events.emit('handle:connection-changed', this)
  }

  fromConfig(data: INodeHandleConfig): void {
    this.key = data.key ?? ''
    this.name = data.name ?? ''
    this.description = data.description ?? ''
    this.accepts = ensureArray(data.accepts)
    this.type = data.type ?? ''
    this.position = data.position ?? HandlePosition.None
    this._value = data.value

    Object.assign(this._options, data.options)
  }
}

function includeAcceptAll(accepts: string[]) {
  return accepts.includes(NodeHandleType.All)
}
