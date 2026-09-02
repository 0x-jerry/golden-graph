import type { Node } from '@0x-jerry/golden-graph'
import type { IRect } from '../utils/RectBox'
import {
  DEFAULT_DRAW,
  DEFAULT_OPTIONS,
  type LayoutOptions,
  type LayoutSize,
  type ResolvedLayoutOptions,
} from './types'

/**
 * Default size estimator for when no `measure` is provided.
 */
export function estimateSize(node: Node): LayoutSize {
  const handleRows = Math.max(node.handles.length, 1)
  return {
    width: DEFAULT_DRAW.nodeWidth,
    height:
      DEFAULT_DRAW.headerHeight +
      handleRows * DEFAULT_DRAW.handleRowHeight +
      DEFAULT_DRAW.bodyPadding,
  }
}

export function resolveLayoutOptions(
  options: LayoutOptions = {},
): ResolvedLayoutOptions {
  return { ...DEFAULT_OPTIONS, ...options }
}

/**
 * Smallest box containing all given boxes; the zero rect when empty.
 */
export function boundingRect(boxes: readonly IRect[]): IRect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  if (!boxes.length) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
