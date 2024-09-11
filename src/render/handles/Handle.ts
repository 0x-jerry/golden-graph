import type { GHandle } from '../../core'
import d3 from 'd3'

export class RHandle<T = unknown> {
  data: GHandle<T>

  _g = d3.create('g')

  get dom() {
    return this._g.node()!
  }

  constructor(data: GHandle<T>) {
    this.data = data

    this._g.attr('data-id', [this.data._handleType, this.data.id].join('-'))
  }
}
