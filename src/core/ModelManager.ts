import type { IGModel } from './Model'

export class ModelManager<T extends IGModel> {
  _data = new Map<string, T>()

  add(t: T) {
    const exists = this._data.has(t.id)

    if (!exists) {
      this._data.set(t.id, t)
    }
  }

  get(id: string) {
    return this._data.get(id)
  }

  remove(id: string) {
    this._data.delete(id)
  }

  all() {
    return [...this._data.values()]
  }
}
