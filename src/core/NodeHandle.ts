import { type Arrayable, ensureArray } from '@0x-jerry/utils'
import { shallowRef } from 'vue'
import { HandlePosition } from './HandlePosition'
import { isIntersected, toReadonly } from './helper'
import type { Node } from './Node'
import type { INodeHandleLoc, ObjectAny } from './types'

export enum NodeHandleType {
  All = '*',
}

/**
 * Options passed to the handle's render component.
 * The {@link type} field maps to a handle component via `getHandleComponent()`.
 */
export interface INodeHandleConfigOptions {
  [key: string]: any

  /**
   * Handle render component type (e.g. 'text', 'number', 'image', 'select', 'display').
   */
  type: string
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
  type?: Arrayable<string>

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
  types: string[] = [NodeHandleType.All]

  key = ''

  name = 'Default Handle'

  position = HandlePosition.None

  _options: ObjectAny = {}

  _node?: Node

  _connectedHandle = shallowRef<NodeHandle>()

  _value = shallowRef<unknown>()

  get connectedHandle() {
    return toReadonly(this._connectedHandle.value)
  }

  get isConnected() {
    return !!this._connectedHandle.value
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

    return this._value.value
  }

  /**
   * Set real value of handle.
   * @param value
   * @returns
   */
  setValue(value: unknown) {
    if (this._value.value === value) {
      return
    }

    this._value.value = value

    this.node.workspace.events.emit('handle:updated', this)
  }

  /**
   * Set value directly without emitting event.
   * @internal
   *
   * @param value
   */
  setInitialValue(value: unknown) {
    this._value.value = value
  }

  /**
   * Get real value of handle.
   * @internal
   *
   * @returns
   */
  getRealValue() {
    return this._value.value
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

  setConnectedHandle(handle?: NodeHandle) {
    this._connectedHandle.value = handle
  }

  fromConfig(data: INodeHandleConfig): void {
    this.key = data.key ?? ''
    this.name = data.name ?? ''
    this.types = ensureArray(data.type)
    this.position = data.position ?? HandlePosition.None
    this._value.value = data.value

    Object.assign(this._options, data.options)
  }
}

function includeTypeAll(types: string[]) {
  return types.includes(NodeHandleType.All)
}
