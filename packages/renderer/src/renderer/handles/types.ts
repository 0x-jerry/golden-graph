import Konva from 'konva'
import type {
  NodeHandle,
  INodeHandleConfigOptions,
} from '@0x-jerry/golden-graph'

/**
 * How a handle's content widget is placed relative to its label.
 *
 * - `'inline'`: content sits next to the label on the same row (default).
 * - `'block'`: label on its own line, content below it spanning the node width.
 */
export type HandleContentLayout = 'inline' | 'block'

/**
 * A render module for a handle's content widget (text/number/select/etc.).
 *
 * Implementations are registered in a registry by string `type` and resolved
 * per-handle. A module is shared across handles, so any per-handle state must
 * be keyed by the handle's Konva group — use a module-level
 * `WeakMap<Konva.Group, ...>` and destroy it in `destroy(group)`.
 */
export interface HandleModule {
  type: string

  create(handle: NodeHandle, options: INodeHandleConfigOptions): Konva.Group

  update?(group: Konva.Group, handle: NodeHandle): void

  destroy?(group: Konva.Group, handle: NodeHandle): void

  /**
   * Release shared resources (e.g. DOM editors) when the renderer is disposed.
   * Called once per module, not per handle.
   */
  dispose?(): void

  config?: {
    /**
     * Content placement relative to the handle label. Defaults to `'inline'`.
     */
    layout?: HandleContentLayout

    /**
     * Minimum height (px) of the block content area. The rendered row grows
     * beyond this when the measured content is taller (wrapping text, images).
     * Defaults to `LAYOUT.HANDLE_ROW_HEIGHT`. Only applies to block handles.
     */
    minHeight?: number
  }
}
