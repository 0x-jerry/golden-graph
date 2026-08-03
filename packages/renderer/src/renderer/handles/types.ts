import Konva from 'konva'
import type {
  NodeHandle,
  INodeHandleConfigOptions,
} from '@0x-jerry/golden-graph'

/**
 * A render module for a handle's content widget (text/number/select/etc.).
 *
 * Implementations are registered in a registry by string `type` and resolved
 * per-handle. A module is instantiated once and shared across handles, so any
 * per-handle state must be keyed by the handle's Konva group — use an instance
 * `WeakMap<Konva.Group, ...>` and destroy it in `destroy(group)`.
 */
export abstract class HandleModule {
  abstract create(
    handle: NodeHandle,
    options: INodeHandleConfigOptions,
  ): Konva.Group

  update?(group: Konva.Group, handle: NodeHandle): void

  destroy?(group: Konva.Group, handle: NodeHandle): void
}