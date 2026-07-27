import type { IDisposable, IDisposableFn } from "./types"

export class Disposable {
  _fns: Set<IDisposableFn | IDisposable> = new Set()

  add(...disposables: Array<IDisposableFn | IDisposable>) {
    for (const fn of disposables) {
      this._fns.add(fn)
    }
  }

  dispose() {
    for (const fn of this._fns) {
      if (typeof fn === 'function') {
        fn()
      } else {
        fn.dispose()
      }
    }

    this._fns.clear()
  }
}
