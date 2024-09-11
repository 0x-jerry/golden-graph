import d3 from 'd3'
import type { IVec2 } from '../math'

export class Coord {
  x: d3.ScaleLinear<number, number, never>
  y: d3.ScaleLinear<number, number, never>

  constructor(size: IVec2) {
    this.x = d3.scaleLinear([0, size.x])
    this.y = d3.scaleLinear([0, size.y])
  }
}
