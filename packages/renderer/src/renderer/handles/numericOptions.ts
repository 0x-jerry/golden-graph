import type { NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import type { NumericFieldConfig } from '../components/NumericField'
import { resolveRange, type NumericRange } from '../numeric'
import { availableWidth } from './utils'

/**
 * Options shared by both numeric handles. A `range` is bounded by itself
 * (default `0..100`); a `number` is bounded only when it has both bounds.
 */
export interface NumericHandleOptions {
  /** Lower bound of the range. */
  min?: number
  /** Upper bound of the range. */
  max?: number
  /** Amount one step adds or subtracts. Defaults to `1`. */
  step?: number
  /**
   * Pixels of drag travel per `step`, i.e. the scrub sensitivity. Defaults to
   * `8` — a slow, precise drag; lower it for a faster one.
   */
  dragSpeed?: number
}

/** Options are an optional bag on the handle; absent reads as empty. */
export function readNumericOptions(handle: NodeHandle): NumericHandleOptions {
  return (handle.getOptions<NumericHandleOptions>() ??
    {}) as NumericHandleOptions
}

/**
 * The range a handle steps through, or `undefined` for an open field:
 * - `range` always has one (`0..100` when unbounded by the schema);
 * - `number` has one only when both `min` and `max` are given, so a plain
 *   number keeps accepting values outside any bound.
 */
export function numericRange(
  type: 'number' | 'range',
  options: NumericHandleOptions,
): NumericRange | undefined {
  if (type === 'number') {
    if (options.min === undefined || options.max === undefined) {
      return undefined
    }
    return resolveRange({
      min: options.min,
      max: options.max,
      step: options.step,
    })
  }
  return resolveRange(options)
}

/**
 * The widget configuration both numeric handles share: a value bar in the
 * row's content column (beside the handle's own label), its value on the side
 * away from the joint, every produced value written straight to the handle.
 */
export function numericFieldConfig(
  handle: NodeHandle,
  type: 'number' | 'range',
  options: NumericHandleOptions,
): NumericFieldConfig {
  return {
    width: availableWidth(handle),
    range: numericRange(type, options),
    step: options.step,
    dragSpeed: options.dragSpeed,
    // The value hugs the end away from the joint: a right handle keeps its
    // number on the left, everything else on the right.
    side: handle.position === HandlePosition.Right ? 'left' : 'right',
    onCommit: (value) => handle.setValue(value),
  }
}

/** Field options carried across an update. */
export function numericFieldOptions(
  type: 'number' | 'range',
  options: NumericHandleOptions,
) {
  return {
    range: numericRange(type, options),
    step: options.step,
    dragSpeed: options.dragSpeed,
  }
}
