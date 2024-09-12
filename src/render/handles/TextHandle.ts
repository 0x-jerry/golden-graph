import type { GHandle } from '../../core'
import { RHandle } from './Handle'

export class RTextHandle<T = unknown> extends RHandle<T> {
  constructor(data: GHandle<T>) {
    super(data)

    this.init()
  }

  init() {
    this._g.append('div').attr('class', 'r-text')

    this.updateUI()
  }

  getContent(): string {
    return (this.data.getValue() as unknown as string) ?? ''
  }

  updateUI() {
    this._g.select('.r-text').text(this.getContent())
  }
}
