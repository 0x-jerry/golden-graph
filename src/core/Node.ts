import type { GHandle } from './Handle'
import { HandleManager } from './HandleManager'
import { GModel, type IGModel } from './Model'

export interface IGNode<Data extends Record<string, unknown> = Record<string, unknown>>
  extends IGModel {
  title: string
  description?: string
  handles: GHandle[]

  data?: Data
}

export class GNode<Data extends Record<string, unknown> = Record<string, unknown>> extends GModel {
  title = 'Node'
  description?: string

  _handles = new HandleManager()
  _data?: Data
  _dirty = true

  constructor(opt: { id?: string; description?: string } = {}) {
    super(opt.id)
    this.description = this.description
  }

  onProcess?: (instance: this) => unknown

  setDirty() {
    this._dirty = true
  }

  setOutputValue(key: string, value: unknown) {
    this._handles.outputs.get(key)?.update(value)
  }

  async getInputValue<T>(key: string) {
    await this.process()

    const value = this._handles.inputs.get(key)?.getValue() as T | undefined
    return value
  }

  addInputHandle(key: string, value: GHandle) {
    value.id = key
    this._handles.inputs.add(value)
  }

  getInputHandle(key: string) {
    return this._handles.inputs.get(key)
  }

  removeInputHandle(key: string) {
    this._handles.inputs.remove(key)
  }

  addOutputHandle(key: string, value: GHandle) {
    value.id = key
    this._handles.outputs.add(value)
  }

  removeOutputHandle(key: string) {
    this._handles.outputs.remove(key)
  }

  getOutputHandle(key: string) {
    return this._handles.outputs.get(key)
  }

  async process() {
    if (this._dirty) {
      await this.onProcess?.(this)
      this._dirty = false
    }
  }
}
