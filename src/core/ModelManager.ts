import { EventEmitter } from '@0x-jerry/utils'
import type { IGModel } from './Model'

export enum ModelManagerChangedType {
  Added = 0,
  Removed = 1,
}

export interface ModelManagerEvents {
  changed: [type: ModelManagerChangedType, id: string]
}

export class ModelManager<
  T extends IGModel,
> extends EventEmitter<ModelManagerEvents> {
  _data = new Map<string, T>()

  add(t: T) {
    const exists = this._data.has(t.id)

    if (!exists) {
      this._data.set(t.id, t)
      this.emit('changed', ModelManagerChangedType.Added, t.id)
    }
  }

  get(id: string) {
    return this._data.get(id)
  }

  remove(id: string) {
    this._data.delete(id)
    this.emit('changed', ModelManagerChangedType.Removed, id)
  }

  all() {
    return [...this._data.values()]
  }
}
