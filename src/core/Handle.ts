import { GModel, type IGModel } from './Model'

export interface IGHandle<T = unknown> extends IGModel {
  id: string
  type: string

  /**
   * @default 0
   */
  order: number

  value?: T
}

export type GetHandleType<T> = T extends IGHandle<infer U> ? U : T

export class GHandle<T = unknown> extends GModel implements IGHandle<T> {
  type: string
  order: number = 0
  value?: T

  constructor(type: string, id?: string) {
    super(id)
    this.type = type
  }
}
