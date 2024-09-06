import type { IGHandle } from './Handle'
import { GModel, type IGModel } from './Model'

type MapHandleType<T extends Record<string, unknown>> = {
  [k in keyof T]?: IGHandle<T[k]>
}

export interface IGNode<
  Input extends Record<string, unknown> = Record<string, unknown>,
  Output extends Record<string, unknown> = Record<string, unknown>,
  Data extends Record<string, unknown> = Record<string, unknown>
> extends IGModel {
  id: string
  inputs: MapHandleType<Input>
  outputs: MapHandleType<Output>
  data?: Data
}

export type IGetNodeData<T extends IGNode> = T extends IGNode<infer I, infer O, infer D>
  ? { input: I; output: O; data: D }
  : never

export class GNode<
    Input extends Record<string, unknown> = Record<string, unknown>,
    Output extends Record<string, unknown> = Record<string, unknown>,
    Data extends Record<string, unknown> = Record<string, unknown>
  >
  extends GModel
  implements IGNode<Input, Output, Data>
{
  inputs: MapHandleType<Input> = {}
  outputs: MapHandleType<Output> = {}
  data?: Data

  constructor(id?: string) {
    super(id)
  }
}
