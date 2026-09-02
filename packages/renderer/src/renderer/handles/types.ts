import Konva from 'konva'
import type {
  NodeHandle,
  INodeHandleConfigOptions,
} from '@0x-jerry/golden-graph'
import type { GraphTheme } from '../../theme'

/**
 * How a handle's content widget is placed relative to its label.
 *
 * - `'inline'`: content sits next to the label on the same row (default).
 * - `'block'`: label on its own line, content below it spanning the node
 *   width. Block content is contained to the node's size — it re-fits into
 *   the space the node allocates the row and is clipped at the node boundary
 *   when it overflows, so it can never expand the node.
 */
export type HandleContentLayout = 'inline' | 'block'

/** Geometry used to draw a handle's joint (connection dot). */
export type HandleJointShape = 'circle' | 'square' | 'diamond' | 'triangle'

/**
 * Visual style of a handle's joint. Defined per handle `type` via the
 * factory's `config.joint`, so the joint look is a pure function of the type.
 */
export interface IHandleJointStyle {
  color: string
  shape: HandleJointShape
}

/**
 * Render config for a handle factory. Applied to every handle created by it.
 */
export interface NodeHandleConfig {
  /**
   * Content placement relative to the handle label. Defaults to `'inline'`.
   */
  layout?: HandleContentLayout

  /**
   * Minimum height (px) of the block content area. Block content is contained
   * into the node's available space and can never expand the node: auto-height
   * nodes render block rows at this minimum, while manually sized nodes give a
   * row whatever height the node affords beyond its other rows. Defaults to
   * `LAYOUT.HANDLE_ROW_HEIGHT`. Only applies to block handles.
   */
  minHeight?: number

  /**
   * Joint (connection dot) style for this handle type. When absent the joint
   * falls back to {@link DEFAULT_JOINT_STYLE}.
   */
  joint?: IHandleJointStyle
}

/**
 * The rendered widget for a single handle. Created per-handle by a
 * `NodeHandleFactory`; the module IS its Konva group, so all per-handle state
 * lives on the module instance itself (no shared registries).
 */
export interface NodeHandleModule extends Konva.Group {
  /** Re-render the widget for the current handle value/size. */
  update?(): void

  /** Re-apply theme-derived colors/fonts on a hot-swap. */
  applyTheme?(theme: GraphTheme): void

  /**
   * Tear down per-handle resources before the Konva group is destroyed.
   * Inherited from `Konva.Group`;
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

  /**
   * Build the content widget for a handle. Optional for types registered purely
   * to style their joint (no value editor). When absent the handle renders
   * label + joint only.
   *
   * The `theme` argument is optional for backward compatibility with external
   * factories that predate theming; the created module can still re-theme via
   * {@link NodeHandleModule#applyTheme}.
   */
  create?(
    handle: NodeHandle,
    options: INodeHandleConfigOptions,
    theme?: GraphTheme,
  ): NodeHandleModule

  /**
   * Release shared resources (e.g. DOM editors) when the renderer is disposed.
   * Called once per factory, not per handle.
   */
  dispose?(): void
}
