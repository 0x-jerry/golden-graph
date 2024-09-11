import type { GNode } from '../core'
import d3 from 'd3'
import { createHandle } from './handles'
import { Vec2, type IVec2 } from '../math'

export interface RNodeOption {
  width?: number
  height?: number
}

export class RNode<
  T extends Record<string, unknown> = Record<string, unknown>
> {
  data: GNode<T>

  _g = d3.create('g')

  _size: IVec2 = new Vec2(200, 400)

  get dom() {
    return this._g.node()!
  }

  constructor(data: GNode<T>, opt?: RNodeOption) {
    this.data = data

    if (opt?.width != null) {
      this._size.x = opt.width
    }

    if (opt?.height != null) {
      this._size.y = opt.height
    }

    this.init()
  }

  init() {
    const rect = this._g
      .append('rect')
      .attr('class', 'r-node')
      .attr('width', this._size.x)
      .attr('height', this._size.y)

    // init handles
    const handles = this.data.getHandles()

    const handleGap = 5

    const size: IVec2 = {
      x: 0,
      y: handleGap
    }

    for (const handle of handles) {
      const _handle = createHandle(handle)

      _handle.attr('transform', `translate(${0}, ${size.y})`)

      _handle.attr('width', this._size.x)

      const _height = _handle.dom.getBBox().height
      this._size.y += _height + handleGap

      this.dom.append(_handle.dom)
    }

    rect.attr('width', size.x)
    rect.attr('height', size.y)
  }
}
