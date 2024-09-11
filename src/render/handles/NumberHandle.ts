import type { GHandle } from '../../core'
import { RHandle } from './Handle'

export class RNumberHandle extends RHandle<number> {
  constructor(data: GHandle<number>) {
    super(data)

    this.init()
  }

  init() {
    this._g.append('div').attr('class', 'r-text')

    this.updateUI()
  }

  updateUI() {
    this._g.select('.r-text').text(this.data.value || 0)
  }
}
