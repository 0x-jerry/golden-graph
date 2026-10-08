export interface NumericRange {
  min: number
  max: number
  step: number
}

/** Digits after the decimal point, `0` for integers and exponents. */
export function decimalPlaces(n: number): number {
  return String(n).split('.')[1]?.length ?? 0
}

/** Rounds to the widest precision of the operands, so `0.1 + 0.1` is `0.2`. */
export function stepValue(
  current: number,
  step: number,
  times: number,
): number {
  const digits = Math.max(decimalPlaces(current), decimalPlaces(step))
  const next = current + step * times
  return digits > 0 ? Number(next.toFixed(digits)) : next
}

/**
 * Normalize a numeric handle's `min`/`max`/`step` options: missing or
 * non-finite bounds fall back to `0`/`100`, reversed bounds swap, and a
 * non-positive `step` falls back to `1`.
 */
export function resolveRange(options: {
  min?: number
  max?: number
  step?: number
}): NumericRange {
  const min = readFinite(options.min, 0)
  const max = readFinite(options.max, 100)
  const step = readFinite(options.step, 1)
  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
    step: step > 0 ? step : 1,
  }
}

/**
 * Snap `value` onto the step grid anchored at `min` and clamp it into
 * `[min, max]`. Degenerate ranges (`max <= min`, `step <= 0`) and non-finite
 * values clamp without snapping.
 */
export function quantizeValue(value: number, range: NumericRange): number {
  const { min, max, step } = range
  if (!Number.isFinite(value)) return min

  const clamped = Math.min(max, Math.max(min, value))
  if (max <= min || !(step > 0)) return clamped

  const digits = Math.max(decimalPlaces(step), decimalPlaces(min))
  const steps = Math.round((clamped - min) / step)
  const snapped = min + steps * step
  const rounded = digits > 0 ? Number(snapped.toFixed(digits)) : snapped
  return Math.min(max, Math.max(min, rounded))
}

/** Render a value at the step's precision: step `0.1` prints `0.3`. */
export function formatValue(value: number, step: number): string {
  const digits = decimalPlaces(step)
  return digits > 0 ? value.toFixed(digits) : String(value)
}

/** Keep only the characters a numeric text field can parse. */
export function filterNumericText(text: string): string {
  return text.replace(/[^0-9.-]/g, '')
}

function readFinite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
