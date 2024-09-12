import type { GNode } from '../core'
import * as d3 from 'd3'
import { createHandle } from './handles'
import { Vec2, type IVec2 } from '../math'
import { EventEmitter } from '@0x-jerry/utils'

type INodeEventMap = {
  deleted: []
}

export interface RNodeOption {
  width?: number
  height?: number
}

export class RNode<
  T extends Record<string, unknown> = Record<string, unknown>
> extends EventEmitter<INodeEventMap> {
  data: GNode<T>

  _g = d3.create('div').attr('class', 'r-node')

  _size: IVec2 = new Vec2(200, 400)

  _pos = new Vec2()

  get dom() {
    return this._g.node()!
  }

  constructor(data: GNode<T>, opt?: RNodeOption) {
    super()

    this._g.style('position', 'absolute')

    this.data = data

    if (opt?.width != null) {
      this._size.x = opt.width
    }

    if (opt?.height != null) {
      this._size.y = opt.height
    }

    this._init()
  }

  _init() {
    // init handles
    const handles = this.data.getHandles()

    for (const handle of handles) {
      const _handle = createHandle(handle)

      this.dom.append(_handle.dom)
    }
  }

  update(
    x: d3.ScaleLinear<number, number, never>,
    y: d3.ScaleLinear<number, number, never>,
    scale: number = 1
  ) {
    const pos = this._pos

    this._g
      //
      .style('left', x(pos.x))
      .style('top', y(pos.y))
      .style('scale', scale)
  }
}
