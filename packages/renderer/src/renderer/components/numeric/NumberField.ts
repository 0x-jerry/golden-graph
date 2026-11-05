import type { NodeHandle } from '@0x-jerry/golden-graph'
import {
  FIELD_INSET,
  FIELD_PADDING,
  ARROW_WIDTH,
  NumericField,
  type NumericFieldConfig,
  type NumericFieldSpan,
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

  /**
   * Center the value between the chevron columns. A plain number reads as a
   * free-standing value, not a bar filling toward one end, so it sits in the
   * middle of the track rather than hugging the side away from the joint.
   *
   * The column stays as wide as the widest number the range can print (the
   * base measurement), so a growing value never re-flows or gets clipped; only
   * its x and alignment change, pinning its center to the track's midpoint.
   */
  _valueSpan(): NumericFieldSpan {
    const span = super._valueSpan()
    const left = FIELD_INSET + this.arrowInset + FIELD_PADDING
    const right = this._w - FIELD_INSET - this.arrowInset - FIELD_PADDING
    return {
      x: left + Math.max(0, (right - left - span.width) / 2),
      width: span.width,
      align: 'center',
    }
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
