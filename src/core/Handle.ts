import { GModel } from './Model'
import type { GNode } from './Node'

export enum GHandleType {
  None,
  Input,
  Output,
}

export interface IGHandleOptions<T> {
  id?: string
  defaultValue?: T
  type?: GHandleType
  attrs?: Record<string, unknown>
}

export class GHandle<T = unknown> extends GModel {
  valueType: string
  order: number = 0
  value?: T
  _defaultValue?: T

  _targetHandle?: GHandle
  _node?: GNode

  _type = GHandleType.None

  attrs: Record<string, unknown> = {}

  get isOutput() {
    return this._type === GHandleType.Output
  }

  get isInput() {
    return this._type === GHandleType.Input
  }

  get node() {
    return this._node
  }

  constructor(type: string, opt?: IGHandleOptions<T>) {
    super(opt?.id)

    this.valueType = type

    Object.assign(this.attrs, opt?.attrs)

    this._type = opt?.type ?? GHandleType.None

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
}
