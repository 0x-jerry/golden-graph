import { GModel } from './Model'
import type { GNode } from './Node'

export class GHandle<T = unknown> extends GModel {
  type: string
  order: number = 0
  value?: T

  _defaultValue?: T
  _isInput = false
  _targetHandle?: GHandle
  _node?: GNode

  get isOutput() {
    return !this._isInput
  }

  get node() {
    return this._node
  }

  constructor(type: string, opt?: { id?: string; defaultValue?: T; isInput?: boolean }) {
    super(opt?.id)

    this.type = type
    this._isInput = !!opt?.isInput

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
