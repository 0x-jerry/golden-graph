import { GNode, GWorksapce } from '../core'
import { Vec2, type IVec2 } from '../math'
import * as d3 from 'd3'
import { RNode } from './Node'
import { remove } from '@0x-jerry/utils'
import { Coord } from './Coord'

export class RRenderer {
  _g = d3.create('div').attr('class', 'r-workspace')

  get dom() {
    return this._g.node()!
  }

  size: IVec2 = new Vec2(800, 600)

  nodes: RNode[] = []

  coord: Coord

  constructor(readonly w: GWorksapce) {
    this.coord = new Coord({
      x: 800,
      y: 600
    })

    this._initDom()

    this._updateDom()
  }

  _initDom() {
    this.dom.append(this.coord.dom)

    const _nodes = this.w.nodes.all()

    _nodes.map((t) => this.addNode(t))

    this.coord.on('zoom', () => this._updateDom())
  }

  _updateDom() {
    this.dom.style.width = this.size.x + 'px'
    this.dom.style.height = this.size.y + 'px'
    this.dom.style.position = 'relative'

    const zoomOpt = this.coord.option
    const _x = zoomOpt.rescaleX(this.coord.x)
    const _y = zoomOpt.rescaleX(this.coord.y)

    this.nodes.forEach((n) => {
      n.update(_x, _y, zoomOpt.k)
    })
  }

  addNode(node: GNode) {
    const n = new RNode(node)
    this.dom.append(n.dom)

    n.on('deleted', () => {
      remove(this.nodes, n)
    })

    this.nodes.push(n)
  }

  mount(el: HTMLElement) {
    el.append(this._g.node()!)
  }
}
