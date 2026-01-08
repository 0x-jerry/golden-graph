import { nanoid } from '@0x-jerry/utils'

export interface IGModel {
  id: string
}

export class GModel implements IGModel {
  id: string

  constructor(id = nanoid()) {
    this.id = id
  }
}
