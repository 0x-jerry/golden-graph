import Konva from 'konva'
import { registerStageCursor } from '../cursor'
import { Input } from './input'
import { PADDING, measureTextWidth } from './shared'
import {
  filterNumericText,
  formatValue,
  quantizeValue,
  resolveRange,
  type NumericRange,
} from '../numeric'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

const INPUT_HEIGHT = 18
const TRACK_HEIGHT = 4
const THUMB_RADIUS = 6
const VALUE_GAP = 6
/** Narrowest usable track; below it the value editor hides itself. */
const MIN_TRACK_WIDTH = 24
const MIN_VALUE_WIDTH = 32

export interface RangeSliderConfig {
  rangeWidth: number
  rangeHeight?: number
  value?: number
  min?: number
  max?: number
  step?: number
  /** Show the editable value box beside the track. Defaults to `true`. */
  showEditableValue?: boolean
  onChange?: (value: number) => void
}

export interface RangeSliderOptions {
  min?: number
  max?: number
  step?: number
  showEditableValue?: boolean
}

/**
 * A slider over a numeric `[min, max]` range, snapped to `step`, with an
 * editable value box beside the track. The pointer and the box produce values;
 * the caller renders the current value back in via `setValue(value, true)`
 * (silent) so a re-render can never loop through `onChange`.
 */
export class RangeSlider extends Konva.Group {
  _hit: Konva.Rect
  _track: Konva.Rect
  _fill: Konva.Rect
  _thumb: Konva.Circle
  _input: Input

  _range: NumericRange
  _showEditableValue: boolean
  /** Value currently displayed — always quantized and clamped. */
  _val: number
  /**
   * Last value received from outside, before quantization. A pointer value is
   * committed when it differs from it, so the first interaction corrects an
   * empty or out-of-range stored value even on the clamped end.
   */
  _synced: number | undefined

  _w: number
  _h: number
  _valueWidth = 0
  _pressed = false
  /** Whether the value box is being written by this widget, not by the user. */
  _suppressInput = false
  _theme: GraphTheme
  _onChange?: (value: number) => void

  constructor(config: RangeSliderConfig, theme?: GraphTheme) {
    const t = theme ?? DEFAULT_THEME
    const {
      rangeWidth,
      rangeHeight = INPUT_HEIGHT,
      value,
      min,
      max,
      step,
      showEditableValue = true,
      onChange,
    } = config

    super()

    this._theme = t
    this._onChange = onChange
    this._w = Math.max(0, rangeWidth)
    this._h = rangeHeight
    this._range = resolveRange({ min, max, step })
    this._showEditableValue = showEditableValue
    this._val = quantizeValue(value ?? Number.NaN, this._range)

    this._hit = new Konva.Rect({ fill: 'transparent' })

    this._track = new Konva.Rect({
      height: TRACK_HEIGHT,
      cornerRadius: TRACK_HEIGHT / 2,
      fill: t.colors.bgHover,
      listening: false,
    })
    this._fill = new Konva.Rect({
      height: TRACK_HEIGHT,
      cornerRadius: TRACK_HEIGHT / 2,
      fill: t.colors.accent,
      listening: false,
    })
    this._thumb = new Konva.Circle({
      radius: THUMB_RADIUS,
      fill: t.colors.accent,
      stroke: t.colors.border,
      strokeWidth: 1,
      listening: false,
    })
    this._input = new Input(
      {
        inputWidth: this._w,
        inputHeight: this._h,
        value: this._displayValue(),
        beforeChange: filterNumericText,
        onChange: (text) => this._commitInput(text),
        onStep: (delta) => this._stepInput(delta),
      },
      t,
    )

    this.add(this._hit, this._track, this._fill, this._thumb, this._input)

    this._hit.on('mousedown touchstart', (e) => {
      e.cancelBubble = true
      this._setFromPointer()
      this._startDrag()
    })
    this._hit.on('click tap', (e) => {
      e.cancelBubble = true
    })
    registerStageCursor(this._hit, 'pointer')

    this._sync()
  }

  /** Whether the pointer is currently holding the track. */
  get pressed(): boolean {
    return this._pressed
  }

  getValue(): number {
    return this._val
  }

  setValue(value: number | undefined, silent = false): void {
    const next = quantizeValue(value ?? Number.NaN, this._range)
    const changed = next !== this._val
    this._val = next
    if (changed) {
      this._render()
    }
    if (silent) {
      this._synced = value
      return
    }
    if (changed || value !== this._synced) {
      this._synced = value
      this._onChange?.(next)
    }
  }

  setOptions(options: RangeSliderOptions): void {
    this._range = resolveRange(options)
    this._showEditableValue = options.showEditableValue !== false
    this._val = quantizeValue(this._val, this._range)
    this._sync()
  }

  setWidth(width: number): void {
    const next = Math.max(0, width)
    if (next === this._w) return
    this._w = next
    this._sync()
  }

  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    this._track.fill(theme.colors.bgHover)
    this._fill.fill(theme.colors.accent)
    this._thumb.fill(theme.colors.accent)
    this._thumb.stroke(theme.colors.border)
    this._input.applyTheme(theme)
    this._sync()
  }

  destroy(): this {
    this._endDrag()
    return super.destroy()
  }

  /** Track start in local space, leaving room for the thumb's left half. */
  _trackStart(): number {
    return THUMB_RADIUS
  }

  /** Track end, leaving room for the thumb and the value box. */
  _trackEnd(): number {
    const value = this._valueWidth > 0 ? this._valueWidth + VALUE_GAP : 0
    return Math.max(THUMB_RADIUS, this._w - value - THUMB_RADIUS)
  }

  _ratio(): number {
    const { min, max } = this._range
    return max <= min ? 0 : (this._val - min) / (max - min)
  }

  _measureValueWidth(): number {
    const { min, max, step } = this._range
    const { size, family } = this._theme.fonts
    const text = Math.max(
      measureTextWidth(formatValue(min, step), size, family),
      measureTextWidth(formatValue(max, step), size, family),
    )
    return Math.max(MIN_VALUE_WIDTH, text + PADDING * 2)
  }

  /** Re-measure and re-lay-out the widget, then paint the current value. */
  _sync(): void {
    this._valueWidth = this._showEditableValue ? this._measureValueWidth() : 0
    const available = this._w - THUMB_RADIUS * 2 - MIN_TRACK_WIDTH
    if (this._valueWidth > available) {
      this._valueWidth = 0
    }
    const showInput = this._valueWidth > 0

    this._hit.width(Math.max(0, this._trackEnd() + THUMB_RADIUS))
    this._hit.height(this._h)

    const trackY = (this._h - TRACK_HEIGHT) / 2
    this._track.y(trackY)
    this._fill.y(trackY)

    if (!showInput && this._input.active) {
      this._input.deactivate()
    }
    this._input.visible(showInput)
    this._input.setWidth(this._valueWidth)
    this._input.x(this._w - this._valueWidth)
    this._input.y(0)

    this._render()
  }

  _render(): void {
    const start = this._trackStart()
    const end = this._trackEnd()
    const thumbX = start + this._ratio() * (end - start)

    this._track.x(start)
    this._track.width(Math.max(0, end - start))
    this._fill.x(start)
    this._fill.width(Math.max(0, thumbX - start))
    this._thumb.x(thumbX)
    this._thumb.y(this._h / 2)
    this._syncInputValue()

    this.getLayer()?.batchDraw()
  }

  _displayValue(): string {
    return formatValue(this._val, this._range.step)
  }

  /**
   * Show the current value in the box. Silent: the box's `onChange` is the
   * user-edit path only, so a sync can never loop back into `setValue`.
   */
  _syncInputValue(force = false): void {
    if (this._input.active && !force) return
    this._suppressInput = true
    this._input.setValue(this._displayValue())
    this._suppressInput = false
  }

  _commitInput(text: string): void {
    if (this._suppressInput) return
    const value = text === '' ? Number.NaN : Number(text)
    if (Number.isFinite(value)) {
      this.setValue(value)
    }
    // Force the box to show the committed value: an edit session is still
    // active here and `_syncInputValue` skips those.
    this._syncInputValue(true)
  }

  /** Step from the box's text (ArrowUp/Down), then let the box commit it. */
  _stepInput(delta: number): void {
    const text = this._input.getValue()
    const typed = text === '' ? Number.NaN : Number(text)
    const base = Number.isFinite(typed) ? typed : this._val
    const { step } = this._range
    const next = quantizeValue(base + delta * step, this._range)
    this._input.setValue(formatValue(next, step))
  }

  _pointerX(): number {
    return this._hit.getRelativePointerPosition()?.x ?? 0
  }

  _setFromPointer(): void {
    const start = this._trackStart()
    const span = this._trackEnd() - start
    const raw = span <= 0 ? 0 : (this._pointerX() - start) / span
    const { min, max } = this._range
    this.setValue(min + Math.min(1, Math.max(0, raw)) * (max - min))
  }

  _startDrag(): void {
    if (this._pressed) return
    this._pressed = true
    const stage = this.getStage()
    if (stage) {
      stage.on('mousemove touchmove', this._onMove)
      stage.on('mouseup touchend', this._onUp)
    }
    // A release outside the canvas never reaches the stage, which would leave
    // the drag stuck on; listen on the window so it always ends.
    window.addEventListener('mouseup', this._onUp)
    window.addEventListener('touchend', this._onUp)
  }

  _onMove = (): void => {
    if (!this._pressed) return
    this._setFromPointer()
  }

  _onUp = (): void => {
    this._endDrag()
  }

  _endDrag(): void {
    if (!this._pressed) return
    this._pressed = false
    const stage = this.getStage()
    if (stage) {
      stage.off('mousemove touchmove', this._onMove)
      stage.off('mouseup touchend', this._onUp)
    }
    window.removeEventListener('mouseup', this._onUp)
    window.removeEventListener('touchend', this._onUp)
  }
}
