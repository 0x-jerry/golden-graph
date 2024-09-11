import { GNode, GWorksapce } from '../core'
import { Vec2, type IVec2 } from '../math'
import * as d3 from 'd3'
import { RNode } from './Node'
import { remove } from '@0x-jerry/utils'

export class RRenderer {
  _g = d3.create('div').attr('class', 'r-workspace')

  get dom() {
    return this._g.node()!
  }

  size: IVec2 = new Vec2(800, 600)

  nodes: RNode[] = []

  constructor(readonly w: GWorksapce) {
    this._initDom()

    this._updateDom()
  }

  _initDom() {
    const _nodes = this.w.nodes.all()

    _nodes.map((t) => this.addNode(t))
  }

  _updateDom() {
    this.dom.style.width = this.size.x + 'px'
    this.dom.style.height = this.size.y + 'px'
    this.dom.style.position = 'relative'
  }

  addNode(node: GNode) {
    const n = new RNode(node)

    n.on('deleted', () => {
      remove(this.nodes, n)
    })

    this.nodes.push(n)
  }

  mount(el: HTMLElement) {
    el.append(this._g.node()!)
  }
}
