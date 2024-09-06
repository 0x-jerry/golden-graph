import { uuid } from '@0x-jerry/utils'

export interface IGModel {
  id: string
}

export class GModel implements IGModel {
  id: string

  constructor(id = uuid()) {
    this.id = id
  }
}
