import { Vec2, type IVec2 } from '../math'
import type { GHandle } from './Handle'
import { HandleManager } from './HandleManager'
import { GModel, type IGModel } from './Model'

export interface IGNode<Data extends Record<string, any> = Record<string, any>> extends IGModel {
  title: string
  description?: string
  handles: GHandle[]

  data?: Data
}

export class GNode<Data extends Record<string, any> = Record<string, any>> extends GModel {
  title = 'Node'
  description?: string

  _handles = new HandleManager()
  _data?: Data
  _dirty = true

  pos: IVec2 = new Vec2(0, 0)

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

  getHandles() {
    const hanldes = [
      ...this._handles.inputs._data.values(),
      ...this._handles.defaults._data.values(),
      ...this._handles.outputs._data.values(),
    ]

    return hanldes.sort((a, b) => a.order - b.order)
  }

  async getInputValue<T>(key: string) {
    await this.process()

    const value = this._handles.inputs.get(key)?.getValue() as T | undefined
    return value
  }

  addInputHandle(handle: GHandle) {
    this._handles.inputs.add(handle)
  }

  getInputHandle(key: string) {
    return this._handles.inputs.get(key)
  }

  removeInputHandle(key: string) {
    this._handles.inputs.remove(key)
  }

  addOutputHandle(handle: GHandle) {
    this._handles.outputs.add(handle)
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

  move(x: number, y: number) {
    this.pos.x += x
    this.pos.y += y
  }

  moveTo(x: number, y: number) {
    this.pos.x = x
    this.pos.y = y
  }
}
