import { NumericField } from '../NumericField'

/**
 * The ranged numeric bar — a scene slider: the bar fills to the current value
 * (the progress display), and that is the whole widget. No step chevrons — a
 * range is read and dragged, not nudged from its ends — so the value owns the
 * full width of the bar.
 */
export class RangeField extends NumericField {
  protected showsProgress(): boolean {
    return true
  }
}
