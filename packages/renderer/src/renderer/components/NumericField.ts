import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Input } from './input'
import { Scrub, normalizeSpeed } from './scrub'
import {
  formatValue,
  quantizeValue,
  resolveRange,
  type NumericRange,
} from '../numeric'
import { HANDLE_CONTENT_Y_OFFSET, LAYOUT } from '../constants'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

/**
 * Bar height. A little shorter than the handle row, so the row keeps its
 * spacing and the bar reads as a field inset within it rather than a filled
 * row — the proportions of the scene field it is modelled on.
 */
export const FIELD_HEIGHT = LAYOUT.HANDLE_ROW_HEIGHT - 6
/**
 * Local Y of the bar inside the handle content group. That group starts
 * `HANDLE_CONTENT_Y_OFFSET` above the row's center line — an offset tuned for
 * text rows, whose glyphs hang below it — so the bar shifts up by half its own
 * height to sit centered in the row instead of flush with its bottom edge.
 */
export const FIELD_Y = HANDLE_CONTENT_Y_OFFSET - FIELD_HEIGHT / 2
/** Inset of the bar from the content box, so its rounded caps stay visible. */
export const FIELD_INSET = 2
export const FIELD_RADIUS = 4
/** Gap between the bar's edge and the text it holds. */
export const FIELD_PADDING = 8
/** Width of one step-chevron column at an end of the bar. */
export const ARROW_WIDTH = 14
/** Transparent hit padding around a chevron so a small glyph still clicks. */
export const ARROW_HIT_PADDING = 4
const CHEVRON_SIZE = 3.5
const CHEVRON_STROKE = 1.5

export interface NumericFieldConfig {
  width: number
  /**
   * The value range the bar steps through. A `range` handle always has one
   * (`0..100` by default); a plain number passes `undefined` when it has no
   * bounds, which leaves it open — only its `step` grid applies.
   */
  range?: NumericRange
  step?: number
  /** Pixels of drag travel per `step`. Defaults to `8`. */
  dragSpeed?: number
  /**
   * Which end the value hugs: the side away from the handle's joint, so a left
   * handle ends with its number and a right handle starts with it.
   */
  side: 'left' | 'right'
  /** Receives every value the user produces (scrub, chevron or typed). */
  onCommit(value: number): void
}

/**
 * An unbounded range: only a step grid, no clamp. `resolveRange` cannot
 * express this — it always supplies `0..100` bounds.
 */
function openRange(step: number | undefined): NumericRange {
  const resolved = resolveRange({ step })
  return {
    min: -Number.MAX_SAFE_INTEGER,
    max: Number.MAX_SAFE_INTEGER,
    step: resolved.step,
  }
}

export interface NumericFieldOptions {
  range?: NumericRange
  step?: number
  dragSpeed?: number
}

/**
 * The numeric value bar — a scene editor's slider field: a rounded track with
 * a progress fill, the value on it, and a step chevron at each end. It is the
 * widget of a numeric handle, sitting beside the handle's own row label, so
 * the label keeps its usual column and the bar takes the rest of the row.
 *
 * The whole bar scrubs: drag to step the value by the pointer's travel, and
 * double-click to type (the caret takes over the value, the chevrons fold
 * away). Subclasses differ only in what the chevrons and the fill mean: a
 * range fills to its value and always shows both chevrons, a plain number
 * fills nothing and only shows a chevron at a bound its value fell past.
 */
export abstract class NumericField extends Konva.Group {
  readonly handle: NodeHandle

  _theme: GraphTheme
  _cfg: NumericFieldConfig
  _range: NumericRange
  _speed: number
  _scrub: Scrub

  _bar: Konva.Rect
  _fill: Konva.Rect
  _value: Konva.Text
  /** Full-bar hit area; the chevron columns sit above it. */
  _surface: Konva.Rect
  _input: Input

  _arrows: StepArrow[] = []
  _editing = false
  /**
   * Travel accumulated during a drag, with the value it started from. See
   * {@link scrubBy} for why the remainder cannot be dropped per frame.
   */
  _scrubAcc: { travel: number; anchor: number } | null = null

  _w: number
  _h = FIELD_HEIGHT

  constructor(
    handle: NodeHandle,
    cfg: NumericFieldConfig,
    theme: GraphTheme = DEFAULT_THEME,
  ) {
    super()
    this.handle = handle
    this._cfg = cfg
    this._theme = theme
    this._w = Math.max(0, cfg.width)
    this._range = cfg.range ?? openRange(cfg.step)
    this._speed = normalizeSpeed(cfg.dragSpeed)

    this.clipX(0)
    this.clipY(0)
    this.clipWidth(this._w)
    this.clipHeight(this._h)
    this.y(FIELD_Y)

    this._bar = new Konva.Rect({
      height: this._h,
      cornerRadius: FIELD_RADIUS,
      fill: theme.colors.fieldBg,
      listening: false,
    })
    this._fill = new Konva.Rect({
      height: this._h,
      cornerRadius: FIELD_RADIUS,
      fill: theme.colors.fieldFill,
      listening: false,
    })
    this._value = this._makeValue()
    this._surface = new Konva.Rect({
      width: this._w,
      height: this._h,
      fill: 'transparent',
    })
    this._input = new Input(
      {
        inputWidth: this._w,
        inputHeight: this._h,
        value: this._format(this.displayed),
        onChange: (text) => this._commitText(text),
        // Arrow keys step from the typed text, like the rest of the bar.
        onStep: (delta) => this._stepTyped(delta),
      },
      theme,
    )
    this._input.visible(false)

    this.add(this._bar, this._fill, this._surface, this._value)
    this._buildChrome()
    this.add(this._input)

    this._scrub = new Scrub({
      target: this._surface,
      speed: this._speed,
      onStart: () => this.beginScrub(),
      onScrub: (delta) => this.scrubBy(delta),
      onEdit: () => this.startEdit(),
    })
    // The first paint runs before the subclass body, so its chrome does not
    // exist yet — it guards itself and paints fully on the next `render()`.
    this.render()
  }

  /** Current value as a number; `undefined` when unset or unparseable. */
  valueOf(): number | undefined {
    const value = Number(this.handle.getValue())
    return Number.isFinite(value) ? value : undefined
  }

  /** The value the bar shows: quantized and clamped into the range. */
  get displayed(): number {
    const value = this.valueOf()
    return value === undefined ? this._quantize(0) : this._quantize(value)
  }

  /** Position of the displayed value across the range, `0`..`1`. */
  get progress(): number {
    const { min, max } = this._range
    return max <= min ? 0 : (this.displayed - min) / (max - min)
  }

  /** Whether the range clamps (a bounded field) or only snaps to the step. */
  get bounded(): boolean {
    return this._range.max - this._range.min < Number.MAX_SAFE_INTEGER
  }

  /**
   * Whether the caret currently owns the value. Derived from the editor, not
   * tracked separately: every way an edit session can end — Enter, Escape,
   * blur, an outside click, or another widget taking over — deactivates the
   * `Input` itself, and a stale flag here would leave the bar stuck in its
   * editing look (value and chevrons hidden) with no way back.
   */
  get editing(): boolean {
    return this._editing && this._input.active
  }

  /**
   * Apply one scrub delta, in **steps** (`Scrub` has already divided the
   * pointer travel by the drag speed).
   *
   * The delta is accumulated, not applied per frame. A value only exists on
   * the step grid (`0.459` at step `0.001`), so one frame of pointer travel is
   * usually less than a whole step; quantizing and re-anchoring every frame
   * throws that remainder away, which is why a slow drag — many small moves —
   * used to leave the number untouched however far the pointer went. Keeping
   * the leftover makes the bar advance as soon as a step has been covered.
   */
  scrubBy(deltaSteps: number) {
    if (!this._scrubAcc) {
      this._scrubAcc = { travel: 0, anchor: this.displayed }
    }
    this._scrubAcc.travel += deltaSteps
    // The target is always the gesture's starting value plus all travel so
    // far — never the last value written. Re-anchoring mid-drag would lose the
    // sub-step remainder (so slow drags would never move) and would eat the
    // distance spent past a bound (so reversing would feel dead).
    this._emit(this._scrubAcc.anchor + this._scrubAcc.travel * this._range.step)
  }

  /**
   * Forget any accumulated travel, e.g. when a new gesture starts. Called by
   * `Scrub` on pointer down.
   */
  beginScrub() {
    this._scrubAcc = null
  }

  /** Step the value by one `step`. */
  step(dir: -1 | 1) {
    this._scrubAcc = null
    this._emit(this.displayed + dir * this._range.step)
  }

  /** Open the caret over the bar, with the value selected. */
  startEdit() {
    if (this.editing) return
    this._editing = true
    this._input.visible(true)
    // Every way this session can end — Enter, Escape, blur, an outside click —
    // runs the editor's stop hook, so the bar repaints itself instead of
    // waiting for the next workspace update.
    this._input._onStopEdit = () => this.endEdit()
    this._input._startEdit()
    this._input.selectAll()
    this.render()
  }

  /**
   * A session ended through the editor (blur included): clear the flag and
   * repaint the idle look. `stopEdit` uses the same path, and is a no-op when
   * the editor already ended the session itself.
   */
  endEdit() {
    if (!this._editing) return
    this._editing = false
    this._input.visible(false)
    this.render()
  }

  /** Every chevron column (the subclass builds and owns the pair). */
  get arrows(): StepArrow[] {
    return this._arrows
  }

  /** Close the caret, committing (or reverting) the typed text. */
  stopEdit(commit = true) {
    if (!this.editing) {
      this.endEdit()
      return
    }
    this._input._stopEdit(commit)
    this.endEdit()
  }

  setWidth(width: number) {
    const next = Math.max(0, width)
    if (next === this._w) return
    this._w = next
    this.clipWidth(next)
    this.render()
  }

  setOptions(options: NumericFieldOptions) {
    this._range = options.range ?? openRange(options.step)
    this._speed = normalizeSpeed(options.dragSpeed)
    this._scrub._speed = this._speed
    for (const arrow of this._arrows) arrow.scrub._speed = this._speed
    this.render()
  }

  applyTheme(theme: GraphTheme) {
    this._theme = theme
    this._bar.fill(theme.colors.fieldBg)
    this._fill.fill(theme.colors.fieldFill)
    this._value.fontFamily(theme.fonts.family)
    this._value.fontSize(theme.fonts.size)
    this._value.y((this._h - theme.fonts.size) / 2)
    this._value.fill(theme.colors.textPrimary)
    for (const { chevron } of this._arrows) {
      chevron.stroke(theme.colors.textMuted)
    }
    this._input.applyTheme(theme)
    this.render()
  }

  destroy(): this {
    this._scrub.destroy()
    for (const arrow of this._arrows) arrow.scrub.destroy()
    this._input.destroy()
    return super.destroy()
  }

  // --- painting ------------------------------------------------------------

  /** Width of the bar itself (the content box, minus its inset). */
  get barWidth(): number {
    return Math.max(0, this._w - FIELD_INSET * 2)
  }

  /** Repaint the bar for the current value, width and edit state. */
  render() {
    // A session can end without going through `stopEdit` (blur, outside click,
    // another widget becoming active). Every repaint reconciles the flag, and
    // the renderer repaints on any workspace change — so the bar always falls
    // back to its idle look as soon as the caret is gone.
    if (this._editing && !this._input.active) {
      this._editing = false
      this._input.visible(false)
    }

    const width = this.barWidth
    const fillWidth = this.showsProgress()
      ? Math.max(0, width * this.progress)
      : 0

    this._bar.x(FIELD_INSET).width(width)
    this._fill.x(FIELD_INSET).width(fillWidth)
    this._layoutValue()
    // The caret owns the bar while editing: the painted value and the step
    // columns give way to it.
    this._value.visible(!this._editing)
    this._input.visible(this._editing)
    if (this._editing) {
      this._input.setValue(this._format(this.displayed))
    }
    this._layoutChrome()
    this.getLayer()?.batchDraw()
  }



  /** Whether the bar paints progress behind the value (range handles do). */
  protected abstract showsProgress(): boolean

  /** Build the subclass chrome (chevron columns) — once, before first paint. */
  protected abstract _buildChrome(): void

  /**
   * Show / place the subclass chrome. Also runs during the first paint, before
   * the subclass constructor body, so it must tolerate a missing chrome.
   */
  protected abstract _layoutChrome(): void

  /**
   * The value's column, in local space: the end away from the handle's joint,
   * between the chevron columns, wide enough for the widest number the range
   * can print — so the text does not shift while the value is scrubbed.
   */
  _valueSpan(): { x: number; width: number; align: 'left' | 'right' } {
    // `side: 'left'` means the value sits on the left half of the bar.
    const atLeft = this._cfg.side === 'left'
    if (!this._value) {
      return { x: 0, width: 0, align: atLeft ? 'left' : 'right' }
    }
    // Measure every candidate through the node and keep the widest.
    const text = this._value.text()
    // An open range has no bounds to measure, so the value itself is the only
    // width candidate.
    const candidates = this.bounded
      ? [this.displayed, this._range.min, this._range.max]
      : [this.displayed]
    const widths = candidates.map((value) => {
      this._value.text(this._format(value))
      return this._value.getTextWidth()
    })
    this._value.text(text)

    const start = FIELD_INSET + ARROW_WIDTH + FIELD_PADDING
    const end = this._w - FIELD_INSET - ARROW_WIDTH - FIELD_PADDING
    const width = Math.min(
      Math.max(0, end - start),
      Math.ceil(Math.max(...widths)),
    )
    return {
      x: atLeft ? start : end - width,
      width,
      align: atLeft ? 'left' : 'right',
    }
  }

  /** The value sits at the end opposite the widget's joint. */
  _layoutValue() {
    const span = this._valueSpan()
    // `width()` re-derives the alignment from the current `align()` side, so
    // the side is set after the box is sized.
    this._value.width(span.width)
    this._value.align(span.align)
    this._value.x(span.x)
    // The caret takes the value's seat, widened over the chevron columns.
    const start = FIELD_INSET + ARROW_WIDTH
    const end = this._w - FIELD_INSET - ARROW_WIDTH
    this._input.setWidth(Math.max(0, end - start))
    this._input.x(start)
    this._input.y(0)
  }

  /** Refresh the painted value from the handle and repaint. */
  refresh() {
    this._value.text(this._format(this.displayed))
    this.render()
  }

  _commitText(text: string) {
    const parsed = text === '' ? Number.NaN : Number(text)
    if (Number.isFinite(parsed)) {
      this._emit(parsed)
    }
    this.refresh()
  }

  /** ArrowUp/ArrowDown while editing: step the caret's number in place. */
  _stepTyped(delta: number) {
    const typed = Number(this._input.getValue())
    const base = Number.isFinite(typed) ? typed : this.displayed
    this._input.setValue(
      this._format(this._quantize(base + delta * this._range.step)),
    )
  }

  /**
   * Write a user-produced value and repaint immediately. The owner turns the
   * commit into a handle update, and the next `update()` repaints again — but
   * the bar must move with the pointer even if that cycle is deferred (during
   * a drag, say), so it paints its own change here.
   */
  _emit(value: number) {
    this._cfg.onCommit(this._quantize(value))
    if (!this._editing) this.refresh()
  }

  /**
   * Snap a value onto the field's grid. A bounded field clamps too; an open one
   * only rounds to the step's precision, so it must not be quantized against
   * the synthetic open bounds (their enormous `min` breaks the grid).
   */
  _quantize(value: number): number {
    if (this.bounded) return quantizeValue(value, this._range)
    const digits = String(this._range.step).split('.')[1]?.length ?? 0
    return digits > 0 ? Number(value.toFixed(digits)) : Math.round(value)
  }

  _format(value: number): string {
    return formatValue(value, this._range.step)
  }

  _makeValue(): Konva.Text {
    const { size, family } = this._theme.fonts
    return new Konva.Text({
      y: (this._h - size) / 2,
      text: this._format(this.displayed),
      fontSize: size,
      fontFamily: family,
      fill: this._theme.colors.textPrimary,
      wrap: 'none',
      lineHeight: 1,
      listening: false,
    })
  }

  /**
   * One chevron column. Pressing it steps the value once in `dir`; dragging
   * from it scrubs, so an imprecise press does not lose the gesture.
   */
  protected _createArrow(dir: -1 | 1, side: 'left' | 'right'): StepArrow {
    const group = new Konva.Group({ name: `step-${side}` })
    const hit = new Konva.Rect({
      width: ARROW_WIDTH + ARROW_HIT_PADDING * 2,
      height: this._h,
      fill: 'transparent',
      cornerRadius: FIELD_RADIUS,
    })
    const chevron = new Konva.Line({
      x: ARROW_HIT_PADDING + ARROW_WIDTH / 2,
      y: this._h / 2,
      points: [
        CHEVRON_SIZE,
        -CHEVRON_SIZE,
        -CHEVRON_SIZE,
        0,
        CHEVRON_SIZE,
        CHEVRON_SIZE,
      ],
      stroke: this._theme.colors.textMuted,
      strokeWidth: CHEVRON_STROKE,
      lineCap: 'round',
      lineJoin: 'round',
      listening: false,
    })
    // The glyph points left by default; `+1` mirrors it to point right.
    if (dir === 1) chevron.scaleX(-1)
    group.add(hit, chevron)
    this.add(group)

    const scrub = new Scrub({
      target: group,
      speed: this._speed,
      onStart: () => this.step(dir),
      onScrub: (delta) => {
        if (delta !== 0) this.scrubBy(delta)
      },
      onEdit: () => this.startEdit(),
    })
    const arrow = { group, chevron, dir, side, scrub }
    this._arrows.push(arrow)
    return arrow
  }
}

/** A chevron column of the bar. */
export interface StepArrow {
  group: Konva.Group
  chevron: Konva.Line
  dir: -1 | 1
  side: 'left' | 'right'
  scrub: Scrub
}
