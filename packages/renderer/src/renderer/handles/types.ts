import Konva from 'konva'
import type {
  NodeHandle,
  INodeHandleConfigOptions,
} from '@0x-jerry/golden-graph'

export interface HandleModule {
  create(handle: NodeHandle, options: INodeHandleConfigOptions): Konva.Group
  update?(group: Konva.Group, handle: NodeHandle): void
  destroy?(group: Konva.Group): void
}
