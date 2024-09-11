import type { GHandle } from '../../core'
import d3 from 'd3'
import { RHandle } from './Handle'

export class RNumberHandle extends RHandle<number> {

  constructor(data: GHandle<number>) {
    super(data)

    this.init()
  }

  init() {
    this._g.append('text')
    this.updateUI()
  }

  updateUI() {
    this._g.select('text').text(this.data.value || 0)
  }
}
