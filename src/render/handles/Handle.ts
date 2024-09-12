import type { GHandle } from '../../core'
import * as d3 from 'd3'

export class RHandle<T = unknown> {
  data: GHandle<T>

  _g = d3.create('div').attr('class', 'r-handle')

  get dom() {
    return this._g.node()!
  }

  constructor(data: GHandle<T>) {
    this.data = data

    this._g.attr('data-id', [this.data._position, this.data.id].join('-'))
  }

  _init_handle() {
    const size = 4

    this._g
      //
      .append('rect')
      .attr('class', 'r-handle')
      .attr('width', size)
      .attr('height', size)
  }

  attr(key: string, value?: any) {
    if (value != null) {
      return this._g.attr(key)
    }

    this._g.attr(key, value)
  }
}
