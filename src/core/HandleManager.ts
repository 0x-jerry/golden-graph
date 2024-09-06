import { GHandle } from './Handle'
import { ModelManager } from './ModelManager'

export class HandleManager {
  inputs = new ModelManager<GHandle>()
  outputs = new ModelManager<GHandle>()
}
