import { GModel } from './Model'
import type { GNode } from './Node'

export enum GHandleType {
  None,
  Input,
  Output,
}

export interface IGHandleOptions<T> {
  name: string
  type: string
  id?: string
  defaultValue?: T
  handleType?: GHandleType
  attrs?: Record<string, unknown>
}

export class GHandle<T = unknown> extends GModel {
  order: number = 0

  value?: T
  valueType: string

  name: string

  _defaultValue?: T

  _targetHandle?: GHandle
  _node?: GNode

  handleType = GHandleType.None

  attrs: Record<string, unknown> = {}

  get isOutput() {
    return this.handleType === GHandleType.Output
  }

  get isInput() {
    return this.handleType === GHandleType.Input
  }

  get node() {
    return this._node
  }

  constructor(opt: IGHandleOptions<T>) {
    super(opt?.id)

    this.name = opt.name
    this.valueType = opt.type

    Object.assign(this.attrs, opt?.attrs)

    this.handleType = opt?.handleType ?? GHandleType.None

    this._defaultValue = opt?.defaultValue
  }

  update(newValue?: T) {
    this.value = newValue
  }

  getValue() {
    return this.value ?? this._defaultValue
  }

  onConnected(targetHandle: GHandle, updateDirty?: boolean) {
    this._targetHandle = targetHandle

    if (updateDirty) {
      this._node?.setDirty()
    }
  }

  setNode(node: GNode<any>) {
    this._node = node
  }
}
