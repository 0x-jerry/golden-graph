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
 * Render config for a handle factory. Applied to every handle created by it.
 */
export interface NodeHandleConfig {
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

/**
 * The rendered widget for a single handle. Created per-handle by a
 * `NodeHandleFactory`; the module IS its Konva group, so all per-handle state
 * lives on the module instance itself (no shared registries).
 */
export interface NodeHandleModule extends Konva.Group {
  /** Re-render the widget for the current handle value/size. */
  update?(): void

  /**
   * Tear down per-handle resources before the Konva group is destroyed.
   * Inherited from `Konva.Group`; modules override it to add cleanup
   * (e.g. releasing a stage cursor).
   */
  destroy(): this
}

/**
 * A registered handle renderer. Factories are singletons in a registry keyed
 * by string `type`; each `create()` call produces a fresh `NodeHandleModule`
 * bound to one handle.
 */
export interface NodeHandleFactory {
  type: string

  config?: NodeHandleConfig

  create(handle: NodeHandle, options: INodeHandleConfigOptions): NodeHandleModule

  /**
   * Release shared resources (e.g. DOM editors) when the renderer is disposed.
   * Called once per factory, not per handle.
   */
  dispose?(): void
}
