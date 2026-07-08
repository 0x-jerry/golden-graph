export class HandleComponentRegistry<T> {
  private _map = new Map<string, T>()
  private _default?: T

  register(type: string, component: T): this {
    this._map.set(type, component)
    return this
  }

  get(type: string): T | undefined {
    return this._map.get(type) ?? this._default
  }

  setDefault(component: T): this {
    this._default = component
    return this
  }
}
