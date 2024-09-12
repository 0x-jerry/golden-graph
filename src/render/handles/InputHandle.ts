import type { GHandle } from '../../core'
import { RHandle } from './Handle'

export interface IRInputHandleAttrs {
  max: number
  min: number
  step: number
}

export class RInputHandle extends RHandle<number> {
  get attrs() {
    const _attrs: Partial<IRInputHandleAttrs> = this.data.attrs
    return _attrs
  }

  constructor(data: GHandle<number>) {
    super(data)

    this.init()
  }
  init() {
    const attrs = this.attrs

    this._g
      .append('input')
      .attr('class', 'r-input')
      .attr('max', attrs.max!)
      .attr('min', attrs.min!)
      .attr('step', attrs.step!)

    this.updateUI()
  }

  updateUI() {
    this._g.select('.r-input').attr('value', this.data.getValue() || 0)
  }
}
