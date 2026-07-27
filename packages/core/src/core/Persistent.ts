export interface IPersistent<T> {
  toJSON(): T
  fromJSON(data: T): void
}
