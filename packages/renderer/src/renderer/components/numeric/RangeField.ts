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
 * The ranged numeric bar — a scene slider: the bar fills to the current value
 * (the progress display) and both chevron columns are always present, stepping
 * the value down on the left and up on the right.
 */
export class RangeField extends NumericField {
  // Declared without initializers: the base constructor's `_buildChrome()`
  // assigns them before the subclass body runs, so field initializers here
  // would reset what it just built (they run right after `super()`).
  declare _leftArrow: StepArrow
  declare _rightArrow: StepArrow

  constructor(handle: NodeHandle, cfg: NumericFieldConfig, theme?: GraphTheme) {
    super(handle, cfg, theme)
  }

  protected showsProgress(): boolean {
    return true
  }

  protected _buildChrome(): void {
    this._leftArrow = this._createArrow(-1, 'left')
    this._rightArrow = this._createArrow(1, 'right')
  }

  protected _layoutChrome(): void {
    if (!this._leftArrow || !this._rightArrow) return
    const show = !this._editing
    this._leftArrow.group.visible(show)
    this._rightArrow.group.visible(show)
    this._leftArrow.group.position({ x: FIELD_INSET, y: 0 })
    this._rightArrow.group.position({
      x: this._w - FIELD_INSET - ARROW_WIDTH,
      y: 0,
    })
  }
}
