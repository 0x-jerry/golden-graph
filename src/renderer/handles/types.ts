import Konva from 'konva'
import type { NodeHandle } from '../../core'
import type { INodeHandleConfigOptions } from '../../core'

export interface HandleModule {
  create(handle: NodeHandle, options: INodeHandleConfigOptions): Konva.Group
  update?(group: Konva.Group, handle: NodeHandle): void
  destroy?(group: Konva.Group): void
}
