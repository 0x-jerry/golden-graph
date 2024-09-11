import { GModel } from './Model'
import type { GNode } from './Node'

export enum GHandleType {
  Input,
  Output,
  None,
}

export class GHandle<T = unknown> extends GModel {
  type: string
  order: number = 0
  value?: T

  _defaultValue?: T
  _targetHandle?: GHandle
  _node?: GNode

  _handleType = GHandleType.None

  get isOutput() {
    return this._handleType === GHandleType.Output
  }

  get isInput() {
    return this._handleType === GHandleType.Input
  }

  get node() {
    return this._node
  }

  constructor(type: string, opt?: { id?: string; defaultValue?: T; type?: GHandleType }) {
    super(opt?.id)

    this.type = type

    this._handleType = opt?.type ?? GHandleType.None

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
