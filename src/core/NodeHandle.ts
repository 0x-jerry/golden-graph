import { type Arrayable, ensureArray } from '@0x-jerry/utils'
import { shallowRef } from 'vue'
import { HandlePosition } from './HandlePosition'
import { isIntersected, toReadonly } from './helper'
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
  type?: Arrayable<string>

  name?: string

  position?: HandlePosition

  value?: any

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

  getValue<T>(): T | undefined {
    if (this.isLeft && this.connectedHandle) {
      return this.connectedHandle.getValue<T>()
    }

    return this._value.value as T
  }

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
