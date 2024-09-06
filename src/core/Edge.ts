import type { GHandle } from './Handle'
import { GModel } from './Model'

export class GEdge extends GModel {
  start?: GHandle
  end?: GHandle
}
