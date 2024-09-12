import * as d3 from 'd3'
import type { IVec2 } from '../math'
import { EventEmitter } from '@0x-jerry/utils'

type ICoordEventMap = {
  zoom: []
}

export class Coord extends EventEmitter<ICoordEventMap> {
  _g = d3.create('svg').attr('class', 'r-coord')

  x: d3.ScaleLinear<number, number, never>
  y: d3.ScaleLinear<number, number, never>

  zoom = d3.zoom<any, any>().scaleExtent([0.05, 10])

  _x = this._g.append('g').attr('class', 'r-coord-x')
  _y = this._g.append('g').attr('class', 'r-coord-y')

  get dom() {
    return this._g.node()!
  }

  get option() {
    return d3.zoomTransform(this.dom)
  }

  constructor(readonly range: IVec2) {
    super()
    this._g
      .attr('viewBox', [0, 0, range.x, range.y])
      .style('position', 'absolute')
      .style('width', '100%')
      .style('height', '100%')
      .style('left', 0)
      .style('top', 0)

    this.x = d3.scaleLinear().domain([0, range.x]).range([0, range.x])
    this.y = d3.scaleLinear().domain([0, range.y]).range([0, range.y])

    const zoom = this.zoom
    this._g.call(zoom).call(zoom.transform, d3.zoomIdentity)

    this.zoom.on('zoom', () => {
      this.update()
      this.emit('zoom')
    })
  }

  update() {
    const o = this.option
    const x = o.rescaleX(this.x)
    const y = o.rescaleY(this.y)

    const ticks = this.range.x / 50

    const k = this.range.y / this.range.x

    this._x
      .attr('transform', `translate(0, ${this.range.y - 1})`)
      .call(d3.axisTop(x).ticks(ticks))

    this._y.call(d3.axisRight(y).ticks(ticks * k))
  }
}
