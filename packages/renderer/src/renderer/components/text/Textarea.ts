import Konva from 'konva'
import { FormElement } from '../FormElement'
import { registerStageCursor } from '../../cursor'
import { PADDING, measureTextWidth, type BaseFormConfig } from '../shared'
import { TextModel } from '../input/TextModel'
import { HiddenInput } from '../input/HiddenInput'
import { handleInputKeyDown, type InputKeyEnv } from '../input/keyboard'
import { buildTextLayout, type TextLayout } from './TextLayout'
import { ScrollArea } from '../scroll'
import { DEFAULT_THEME } from '../../../theme'
import type { GraphTheme } from '../../../theme'

const CURSOR_WIDTH = 1
const BLINK_INTERVAL = 530
export const LINE_HEIGHT_RATIO = 1.4

export interface TextareaConfig extends BaseFormConfig {
  inputWidth: number
  inputHeight: number
  value?: string
  placeholder?: string
  onChange?: (value: string) => void
  onStopEdit?: () => void
}

/**
 * Multiline text editor: soft-wrapped lines in a fixed-height, vertically
 * scrollable box. Enter commits, Shift+Enter inserts a newline. Geometry comes
 * from {@link TextLayout}; the box and its auto-hiding scrollbar from
 * {@link ScrollArea}.
 */
export class Textarea extends FormElement {
  _bg: Konva.Rect
  _scrollArea: ScrollArea
  _linesText: Konva.Text
  _placeholderNode: Konva.Text
  _composingNode: Konva.Text
  _caret: Konva.Rect
  _selGroup: Konva.Group

  _model: TextModel
  _hidden: HiddenInput
  _keyEnv: InputKeyEnv
  _layout: TextLayout | null = null

  _iw: number
  _ih: number
  _lineHeight: number
  _onChange?: (value: string) => void
  _onStopEdit?: () => void

  _dragging = false
  _blinkTimer: ReturnType<typeof setInterval> | null = null

  _stageMoveFn = () => {
    if (!this._dragging) return
    this._model.moveCursorTo(this._offsetFromPointer())
    this._syncDisplay()
    this._startBlink()
  }

  _stageUpFn = () => {
    this._dragging = false
    this._detachDrag()
    if (this._active) {
      this._hidden.focus()
    }
  }

  _detachDrag() {
    const stage = this.getStage()
    if (stage) {
      stage.off('mousemove touchmove', this._stageMoveFn)
      stage.off('mouseup touchend', this._stageUpFn)
    }
    window.removeEventListener('mouseup', this._stageUpFn)
    window.removeEventListener('touchend', this._stageUpFn)
  }

  constructor(config: TextareaConfig, theme?: GraphTheme) {
    const t = theme ?? DEFAULT_THEME
    const {
      inputWidth,
      inputHeight,
      value = '',
      placeholder = '',
      strokeWidth = 1,
      cornerRadius = 2,
      onChange,
      onStopEdit,
      ...rest
    } = config

    super(rest, t)

    this._iw = inputWidth
    this._ih = inputHeight
    this._lineHeight = Math.round(this._fs * LINE_HEIGHT_RATIO)
    this._onChange = onChange
    this._onStopEdit = onStopEdit

    this._model = new TextModel({
      value,
      measure: (text) => this._measure(text),
    })
    this._hidden = new HiddenInput({
      onInsert: (text) => {
        this._model.insertText(text)
        this._syncDisplay()
        this._startBlink()
      },
      onCompose: () => this._syncDisplay(),
    })
    this._keyEnv = {
      sync: () => this._syncDisplay(),
      blink: () => this._startBlink(),
      commit: () => this._stopEdit(true),
      // Multiline: Escape commits (blur commits too); there is no discard.
      cancel: () => this._stopEdit(true),
      clearHidden: () => this._hidden.clear(),
      multiline: true,
      insertNewline: () => this._insertNewline(),
      moveVertical: (delta, shift) => this._moveVertical(delta, shift),
      homeLine: (shift) => this._moveLineEdge('start', shift),
      endLine: (shift) => this._moveLineEdge('end', shift),
    }

    const textWidth = Math.max(1, inputWidth - PADDING * 2)

    this._bg = new Konva.Rect({
      width: inputWidth,
      height: inputHeight,
      fill: this._fill,
      stroke: this._borderColor,
      strokeWidth,
      cornerRadius,
      listening: false,
    })
    this.add(this._bg)

    this._scrollArea = new ScrollArea({
      width: inputWidth,
      height: inputHeight,
      theme: t,
      wheelStep: this._lineHeight,
    })
    this.add(this._scrollArea)

    this._selGroup = new Konva.Group({ listening: false })
    this._scrollArea.content.add(this._selGroup)

    this._linesText = new Konva.Text({
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: t.colors.textPrimary,
      x: PADDING,
      y: PADDING,
      width: textWidth,
      wrap: 'none',
      lineHeight: LINE_HEIGHT_RATIO,
      listening: false,
    })
    this._scrollArea.content.add(this._linesText)

    this._placeholderNode = new Konva.Text({
      text: placeholder,
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: t.colors.textMuted,
      x: PADDING,
      y: PADDING,
      width: textWidth,
      wrap: 'none',
      listening: false,
    })
    this._scrollArea.content.add(this._placeholderNode)

    this._composingNode = new Konva.Text({
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: t.colors.textMuted,
      visible: false,
      listening: false,
    })
    this._scrollArea.content.add(this._composingNode)

    this._caret = new Konva.Rect({
      width: CURSOR_WIDTH,
      height: this._lineHeight,
      fill: t.colors.textPrimary,
      visible: false,
      listening: false,
    })
    this._scrollArea.content.add(this._caret)

    this._scrollArea.on('mousedown touchstart', (e) => {
      e.cancelBubble = true
      const pos = this._offsetFromPointer()
      this._startEdit(pos)
      this._model.setSelection(pos, pos)
      this._dragging = true
      const stage = this.getStage()
      if (stage) {
        stage.on('mousemove touchmove', this._stageMoveFn)
        stage.on('mouseup touchend', this._stageUpFn)
      }
      // A release outside the canvas never reaches the stage; listen on the
      // window so the drag always ends.
      window.addEventListener('mouseup', this._stageUpFn)
      window.addEventListener('touchend', this._stageUpFn)
    })
    this._scrollArea.on('tap', (e) => {
      e.cancelBubble = true
      this._startEdit(this._offsetFromPointer())
    })
    this._scrollArea.on('dblclick', (e) => {
      e.cancelBubble = true
      this._startEdit()
      this._model.setSelection(0, this._model.value.length)
      this._syncDisplay()
      this._startBlink()
    })

    registerStageCursor(this, 'text')

    this._syncDisplay()
  }

  getValue(): string {
    return this._model.value
  }

  setValue(value: string) {
    if (value === this._model.value) return
    this._model.reset(value)
    this._syncDisplay()
    this._onChange?.(this._model.value)
  }

  /** Resize the box (e.g. when its node is resized) and re-wrap. */
  resize(width: number, height: number) {
    this._iw = width
    this._ih = height
    this._bg.width(width)
    this._bg.height(height)
    this._scrollArea.resize(width, height)
    this._syncDisplay()
  }

  setWidth(width: number) {
    this.resize(width, this._ih)
  }

  /** Select the entire value (used when an edit session opens). */
  selectAll() {
    this._model.selectAll()
    this._syncDisplay()
    this._startBlink()
  }

  _measure(text: string): number {
    return measureTextWidth(text, this._fs, this._ff)
  }

  _offsetFromPointer(): number {
    const rel = this.getRelativePointerPosition()
    if (!rel || !this._layout) return this._model.value.length
    const localY = rel.y - PADDING + this._scrollArea.scrollTop
    const line = this._layout.lineAtY(localY)
    return this._layout.offsetAt(rel.x - PADDING, line)
  }

  _insertNewline() {
    this._model.insertText('\n')
    this._syncDisplay()
    this._startBlink()
  }

  _moveVertical(delta: number, shift: boolean) {
    const layout = this._layout
    if (!layout) return
    const { line, x } = layout.pointAt(this._model.cursorPos)
    const target = Math.max(0, Math.min(layout.lines.length - 1, line + delta))
    if (target === line) return
    this._model.moveTo(layout.offsetAt(x, target), shift)
    this._syncDisplay()
    this._startBlink()
  }

  _moveLineEdge(edge: 'start' | 'end', shift: boolean) {
    const layout = this._layout
    if (!layout) return
    const { line } = layout.pointAt(this._model.cursorPos)
    const target = layout.lines[line]
    if (!target) return
    this._model.moveTo(edge === 'start' ? target.start : target.end, shift)
    this._syncDisplay()
    this._startBlink()
  }

  _syncDisplay(syncScroll = true) {
    this._relayout()
    const layout = this._layout!
    this._linesText.text(layout.lines.map((l) => l.text).join('\n'))
    this._placeholderNode.visible(this._model.value.length === 0)
    this._syncCaret()
    this._syncSelection()
    this._syncComposing()
    if (syncScroll) this._syncScroll()
    this.getLayer()?.batchDraw()
  }

  _relayout() {
    const textWidth = Math.max(1, this._iw - PADDING * 2)
    this._layout = buildTextLayout({
      text: this._model.value,
      width: textWidth,
      lineHeight: this._lineHeight,
      measure: (text) => this._measure(text),
    })
    this._linesText.width(textWidth)
    this._linesText.fontSize(this._fs)
    this._linesText.fontFamily(this._ff)
    this._placeholderNode.width(textWidth)
    this._scrollArea.setContentHeight(this._layout.height + PADDING * 2)
  }

  _syncCaret() {
    const layout = this._layout
    if (!layout) return
    const { line, x } = layout.pointAt(this._model.cursorPos)
    this._caret.x(PADDING + x)
    this._caret.y(PADDING + line * this._lineHeight)
    this._caret.height(this._lineHeight)
  }

  _syncSelection() {
    this._selGroup.destroyChildren()
    const layout = this._layout
    if (!layout) return
    const range = this._model.selRange()
    if (!range) return
    const [s, e] = range
    for (let i = 0; i < layout.lines.length; i++) {
      const line = layout.lines[i]!
      const from = Math.max(s, line.start)
      const to = Math.min(e, line.end)
      if (from >= to && !(line.start === line.end && s <= line.start && e >= line.end)) {
        continue
      }
      const x0 = PADDING + this._measure(line.text.slice(0, from - line.start))
      const x1 = PADDING + this._measure(line.text.slice(0, to - line.start))
      this._selGroup.add(
        new Konva.Rect({
          x: x0,
          y: PADDING + i * this._lineHeight,
          width: Math.max(1, x1 - x0),
          height: this._lineHeight,
          fill: this._theme.colors.selectionFill,
          listening: false,
        }),
      )
    }
  }

  _syncComposing() {
    const text = this._hidden.composingText
    const layout = this._layout
    if (!text || !layout) {
      this._composingNode.visible(false)
      return
    }
    const { line, x } = layout.pointAt(this._model.cursorPos)
    this._composingNode.text(text)
    this._composingNode.x(PADDING + x)
    this._composingNode.y(PADDING + line * this._lineHeight)
    this._composingNode.visible(true)
  }

  _syncScroll() {
    // Only chase the caret while editing; a committed box keeps its position.
    if (!this._active) return
    const layout = this._layout
    if (!layout) return
    const { line } = layout.pointAt(this._model.cursorPos)
    const caretTop = PADDING + line * this._lineHeight
    const caretBottom = caretTop + this._lineHeight
    const top = this._scrollArea.scrollTop
    if (caretTop < top) {
      this._scrollArea.scrollTo(caretTop)
    } else if (caretBottom > top + this._ih) {
      this._scrollArea.scrollTo(caretBottom - this._ih)
    }
  }

  _syncHiddenPos() {
    const abs = this._caret.getAbsolutePosition()
    this._hidden.setPosition(abs.x, abs.y)
  }

  _startBlink() {
    this._stopBlink()
    this._caret.visible(true)
    this._blinkTimer = setInterval(() => {
      this._caret.visible(!this._caret.visible())
      this.getLayer()?.batchDraw()
    }, BLINK_INTERVAL)
  }

  _stopBlink() {
    if (this._blinkTimer !== null) {
      clearInterval(this._blinkTimer)
      this._blinkTimer = null
    }
    this._caret.visible(false)
  }

  _startEdit(pos?: number) {
    if (this._active) {
      if (pos !== undefined) {
        this._model.setCursor(pos)
        this._syncDisplay()
        this._startBlink()
      }
      return
    }

    this._activate()
    this._model.commit()
    this._model.setCursor(pos ?? this._model.value.length)

    this._bg.stroke(this._theme.colors.accent)

    const stage = this.getStage()
    if (stage) {
      this._hidden.attach(stage.container())
      this._syncHiddenPos()
      this._hidden.focus()
    }

    this._syncDisplay()
    this._startBlink()
  }

  _stopEdit(commit: boolean) {
    if (!this._active) return

    this._stopBlink()
    this._selGroup.destroyChildren()

    this._bg.stroke(this._borderColor)

    this._hidden.detach()
    this._composingNode.visible(false)

    if (!commit) {
      this._model.revert()
    } else if (this._model.value !== this._model.committed) {
      this._model.commit()
      this._onChange?.(this._model.value)
    }

    this._model.clearSelection()
    // Keep the committed scroll position: re-syncing here would snap back to
    // the caret instead of leaving the box where the user left it.
    this._syncDisplay(false)

    this._unbindEvents()
    this._active = false
    this._onStopEdit?.()
  }

  protected _onKeyDown(e: KeyboardEvent) {
    if (this._hidden.composing || e.isComposing || e.keyCode === 229) return
    handleInputKeyDown(this._model, e, this._keyEnv)
  }

  protected _deactivate() {
    this._stopEdit(true)
  }

  destroy(): this {
    this._stopEdit(false)
    this._hidden.detach()
    this._detachDrag()
    return super.destroy()
  }

  applyTheme(theme: GraphTheme): void {
    super.applyTheme(theme)

    this._lineHeight = Math.round(this._fs * LINE_HEIGHT_RATIO)

    this._bg.fill(this._fillExplicit ? this._fill : theme.colors.bg)
    this._bg.stroke(this._active ? theme.colors.accent : this._borderColor)

    for (const node of [
      this._linesText,
      this._placeholderNode,
      this._composingNode,
    ]) {
      node.fontFamily(theme.fonts.family)
      node.fontSize(this._fs)
    }
    this._linesText.fill(theme.colors.textPrimary)
    this._placeholderNode.fill(theme.colors.textMuted)
    this._composingNode.fill(theme.colors.textMuted)
    this._caret.fill(theme.colors.textPrimary)

    this._scrollArea.applyTheme(theme)
    this._syncDisplay()
  }
}
