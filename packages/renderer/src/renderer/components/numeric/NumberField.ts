import type { NodeHandle } from '@0x-jerry/golden-graph'
import {
  FIELD_INSET,
  ARROW_WIDTH,
  NumericField,
  type NumericFieldConfig,
  type StepArrow,
} from '../NumericField'
import type { GraphTheme } from '../../../theme'

/**
 * The plain numeric bar: the same widget as a range, without progress — a
 * single value has no width across the range, so the bar stays unfilled.
 *
 * Both chevron columns belong at the range's ends. They appear only once the
 * value sits **outside** them: a left chevron at the minimum and a right one
 * at the maximum, each snapping the value back onto that bound — the "pushed
 * past its limits" state a scene field shows.
 */
export class NumberField extends NumericField {
  // Declared without initializers: the base constructor's `_buildChrome()`
  // assigns them before the subclass body runs, so field initializers here
  // would reset what it just built (they run right after `super()`).
  declare _leftArrow: StepArrow
  declare _rightArrow: StepArrow

  constructor(handle: NodeHandle, cfg: NumericFieldConfig, theme?: GraphTheme) {
    super(handle, cfg, theme)
  }

  protected showsProgress(): boolean {
    return false
  }

  /** Which bound the stored — not the clamped — value sits beyond. */
  _outOfRange(): { below: boolean; above: boolean } {
    const value = this.valueOf()
    if (value === undefined) return { below: false, above: false }
    return { below: value < this._range.min, above: value > this._range.max }
  }

  protected _buildChrome(): void {
    this._leftArrow = this._createArrow(-1, 'left')
    this._rightArrow = this._createArrow(1, 'right')
    // An arrow sits at the edge of the range it points across, so pressing it
    // steps *off* that edge: from below the minimum it steps up to `min`.
    this._leftArrow.scrub._cfg.onStart = () => this._emit(this._range.min)
    this._rightArrow.scrub._cfg.onStart = () => this._emit(this._range.max)
  }

  protected _layoutChrome(): void {
    if (!this._leftArrow || !this._rightArrow) return
    const { below, above } = this._outOfRange()
    const show = !this._editing
    this._leftArrow.group.visible(show && below)
    this._rightArrow.group.visible(show && above)
    this._leftArrow.group.position({ x: FIELD_INSET, y: 0 })
    this._rightArrow.group.position({
      x: this._w - FIELD_INSET - ARROW_WIDTH,
      y: 0,
    })
  }
}
