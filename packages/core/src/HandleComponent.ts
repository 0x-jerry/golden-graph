export class HandleComponentRegistry<T> {
  private _map = new Map<string, T>()

  register(type: string, component: T): this {
    this._map.set(type, component)
    return this
  }

  get(type: string): T | undefined {
    return this._map.get(type)
  }
}
