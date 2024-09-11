import d3 from 'd3'
import type { IVec2 } from '../math'
import { EventEmitter } from '@0x-jerry/utils'

type ICoordEventMap = {
  zoom: []
}

export class Coord extends EventEmitter<ICoordEventMap> {
  _g = d3.create('div').attr('class', 'r-coord')

  x: d3.ScaleLinear<number, number, never>
  y: d3.ScaleLinear<number, number, never>

  zoom = d3.zoom<any, any>().scaleExtent([0.05, 10])

  get dom() {
    return this._g.node()!
  }

  get option() {
    return d3.zoomTransform(this.dom)
  }

  constructor(size: IVec2) {
    super()

    this.x = d3.scaleLinear([0, size.x])
    this.y = d3.scaleLinear([0, size.y])

    const zoom = this.zoom
    this._g.call(zoom).call(zoom.transform, d3.zoomIdentity)

    this.zoom.on('zoom', () => this.emit('zoom'))
  }
}
