import { EventEmitter, nanoid } from '@0x-jerry/utils'

export interface IGModel {
  id: string
}

export interface GModelEvents {
  updated: []
}

export class GModel<Events = {}>
  extends EventEmitter<GModelEvents & Events>
  implements IGModel
{
  id: string

  constructor(id = nanoid()) {
    super()

    this.id = id
  }
}
