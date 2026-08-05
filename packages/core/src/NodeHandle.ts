import { type Arrayable, ensureArray } from '@0x-jerry/utils'
import { HandlePosition } from './HandlePosition'
import { isIntersected, toReadonly } from './helper'
import type { Node } from './Node'
import type { INodeHandleLoc, ObjectAny } from './types'

export enum NodeHandleType {
  All = '*',
}

/**
 * Options passed to the handle's render component.
 */
export interface INodeHandleConfigOptions {
  [key: string]: any
}

/**
 * Configuration used when adding a handle to a node via `Node.addHandle()`.
 */
export interface INodeHandleConfig {
  /**
   * Unique key within the node — used to identify the handle.
   */
  key?: string

  /**
   * Accepted data type(s) for connection matching. Use `'*'` to accept any type.
   */
  accepts?: Arrayable<string>

  /**
   * Handle render component type (e.g. 'text', 'number', 'image', 'select', 'display').
   */
  type?: string

  /**
   * Display name shown on the handle.
   */
  name?: string

  /**
   * Visual position on the node (Left = input, Right = output, None = layout-only).
   */
  position?: HandlePosition

  /**
   * Initial value for the handle.
   */
  value?: any

  /**
   * Options forwarded to the handle's render component.
   */
  options?: INodeHandleConfigOptions
}

export class NodeHandle {
  accepts: string[] = [NodeHandleType.All]

  type = ''

  key = ''

  name = 'Default Handle'

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
