import type { GHandle } from './Handle'
import { GModel } from './Model'

export class GEdge extends GModel {
  start: GHandle
  end: GHandle

  constructor (start: GHandle, end: GHandle, id?: string) {
    super(id)

    this.start = start
    this.end = end
  }
}
