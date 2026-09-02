import type { Node, NodeHandle, IVec2 } from '@0x-jerry/golden-graph'
import type { IRect } from '../utils/RectBox'

/**
 * Measured size of a node, in workspace units.
 */
export interface LayoutSize {
  width: number
  height: number
}

export interface LayoutOptions {
  /**
   * Gap between consecutive ranks (columns) along the flow axis.
   * @default 60
   */
  xGap?: number

  /**
   * Gap between consecutive nodes within the same rank, on the cross axis.
   * @default 40
   */
  yGap?: number

  /**
   * Gap between independent (disconnected) components.
   * @default 80
   */
  componentGap?: number

  /**
   * Optional metrics provider. When omitted, node sizes are estimated from
   * the default draw constants.
   */
  measure?: (node: Node) => LayoutSize

  /**
   * Local Y of a handle's connection row within its node, from the handle
   * order (header at 0, top row first). When provided, connected handle
   * joints are aligned vertically after layout so edges run horizontally
   * between them instead of slanting between node centers.
   */
  getHandleY?: (node: Node, handle: NodeHandle) => number
}

/**
 * Result of running the pure {@link computeNodePositions} engine.
 */
export interface LayoutResult {
  /**
   * Absolute position per node id.
   */
  positions: Map<number, IVec2>

  /**
   * Bounding box of all laid-out nodes.
   */
  rect: IRect
}

/**
 * Default draw constants used by the size estimator when no `measure` is
 * given. Mirrors the renderer's `LAYOUT` values.
 */
export const DEFAULT_DRAW = {
  nodeWidth: 200,
  headerHeight: 30,
  handleRowHeight: 28,
  bodyPadding: 8,
} as const

export const DEFAULT_OPTIONS: Required<
  Omit<LayoutOptions, 'measure' | 'getHandleY'>
> = {
  xGap: 60,
  yGap: 40,
  componentGap: 80,
}

/**
 * Layout gaps after defaults are applied, plus the optional handle-row
 * resolver. `measure` is intentionally excluded — it is consumed separately.
 */
export type ResolvedLayoutOptions = {
  xGap: number
  yGap: number
  componentGap: number
  getHandleY?: LayoutOptions['getHandleY']
}
