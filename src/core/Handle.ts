import { GModel } from './Model'
import type { GNode } from './Node'

export enum GHandlePosition {
  None,
  Left,
  Right,
  Top,
  Bottom
}

export interface IGHandleOptions<T> {
  id?: string
  defaultValue?: T
  type?: GHandlePosition
  attrs?: Record<string, unknown>
}

export class GHandle<T = unknown> extends GModel {
  type: string
  order: number = 0
  value?: T

  _defaultValue?: T
  _targetHandle?: GHandle
  _node?: GNode

  _position = GHandlePosition.None

  attrs: Record<string, unknown> = {}

  get isOutput() {
    return this._position === GHandlePosition.Right
  }

  get isInput() {
    return this._position === GHandlePosition.Left
  }

  get node() {
    return this._node
  }

  constructor(type: string, opt?: IGHandleOptions<T>) {
    super(opt?.id)

    this.type = type

    Object.assign(this.attrs, opt?.attrs)

    this._position = opt?.type ?? GHandlePosition.None

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
