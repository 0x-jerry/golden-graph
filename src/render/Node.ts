import type { GNode } from '../core'
import d3 from 'd3'
import { createHandle } from './handles'

export class RNode<T extends Record<string, unknown> = Record<string, unknown>> {
  data: GNode<T>

  _g = d3.create('g')

  get dom() {
    return this._g.node()!
  }

  constructor(data: GNode<T>) {
    this.data = data
    this.init()
  }

  init() {
    const rect = this._g.append('rect')

    // init handles
    const handles = this.data.getHandles()

    for (const handle of handles) {
      const t = createHandle(handle)

      rect.node()?.append(t.dom)
    }
  }
}
