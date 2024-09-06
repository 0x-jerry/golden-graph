import { GWorksapce } from '../core'
import type { IVec2 } from '../math'
import * as d3 from 'd3'

export class RRenderer {
  w = new GWorksapce()

  svg: d3.Selection<SVGSVGElement, undefined, null, undefined>

  constructor(size: IVec2) {
    this.svg = d3.create('svg').attr('viewBox', [0, 0, size.x, size.y])
  }

  mount(el: HTMLElement) {
    el.append(this.svg.node()!)
  }

}
