import Konva from 'konva'
import { COLORS } from '../../constants'
import { FormElement } from '../FormElement'
import {
  DEFAULT_HEIGHT,
  PADDING,
  measureTextWidth,
  type BaseFormConfig,
} from '../shared'
import { TextModel } from './TextModel'
import { HiddenInput } from './HiddenInput'
import { handleInputKeyDown, type InputKeyEnv } from './keyboard'

const CURSOR_WIDTH = 1
const BLINK_INTERVAL = 530

export interface InputConfig extends BaseFormConfig {
  inputWidth: number
  inputHeight?: number
  value?: string
  placeholder?: string
  onChange?: (value: string) => void
  beforeChange?: (value: string) => string
}

export class Input extends FormElement {
  _bg: Konva.Rect
  _textNode: Konva.Text
  _placeholderNode: Konva.Text
  _cursorLine: Konva.Rect
  _selRect: Konva.Rect
  _composingNode: Konva.Text

  _model: TextModel
  _hidden: HiddenInput
  _keyEnv: InputKeyEnv

  _scrollX = 0
  _blinkTimer: ReturnType<typeof setInterval> | null = null

  _iw: number
  _ih: number
  _onChange?: (value: string) => void

  _dragging = false
  _wheelFn = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (!this._active) return
    const totalW = this._model.textWidth(this._model.value)
    const maxScroll = Math.max(0, totalW + 2 * PADDING - this._iw)
    if (maxScroll <= 0) return
    e.evt.preventDefault()
    this._scrollX = Math.max(
      0,
      Math.min(maxScroll, this._scrollX + e.evt.deltaX),
    )
    this._syncDisplay()
  }

  _stageMoveFn = () => {
    if (!this._dragging) return
    const relX = this.getRelativePointerPosition()?.x ?? 0
    this._model.moveCursorTo(
      this._model.posFromX(relX - PADDING + this._scrollX),
    )
    this._syncDisplay()
    this._startBlink()
  }

  _stageUpFn = () => {
    this._dragging = false
    const stage = this.getStage()
    if (stage) {
      stage.off('mousemove touchmove', this._stageMoveFn)
      stage.off('mouseup touchend', this._stageUpFn)
    }

    if (this._active) {
      this._hidden.focus()
    }
  }

  constructor(config: InputConfig) {
    const {
      inputWidth,
      inputHeight = DEFAULT_HEIGHT,
      value = '',
      placeholder = '',
      fill = COLORS.BG,
      strokeWidth = 1,
      cornerRadius = 2,
      onChange,
      beforeChange,
      ...rest
    } = config

    super(rest)

    this._iw = inputWidth
    this._ih = inputHeight
    this._onChange = onChange

    this._model = new TextModel({
      value,
      beforeChange,
      measure: (text) => measureTextWidth(text, this._fs, this._ff),
    })
    this._hidden = new HiddenInput({
      onInsert: (text) => {
        this._model.insertText(text)
        this._syncDisplay()
        this._startBlink()
      },
      onCompose: () => {
        this._syncDisplay()
      },
    })
    this._keyEnv = {
      sync: () => this._syncDisplay(),
      blink: () => this._startBlink(),
      commit: () => this._stopEdit(true),
      cancel: () => this._stopEdit(false),
      clearHidden: () => this._hidden.clear(),
    }

    const textY = (inputHeight - this._fs) / 2

    this._bg = new Konva.Rect({
      width: inputWidth,
      height: inputHeight,
      fill,
      stroke: this._borderColor,
      strokeWidth,
      cornerRadius,
    })
    this.add(this._bg)
    this.clipX(0)
    this.clipY(0)
    this.clipWidth(inputWidth)
    this.clipHeight(inputHeight)

    this._selRect = new Konva.Rect({
      x: PADDING,
      y: textY,
      width: 0,
      height: this._fs,
      fill: COLORS.SELECTION_FILL,
      visible: false,
      listening: false,
    })
    this.add(this._selRect)

    this._textNode = new Konva.Text({
      text: this._model.value,
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: COLORS.TEXT_PRIMARY,
      x: PADDING,
      y: textY,
      listening: false,
    })
    this.add(this._textNode)

    this._placeholderNode = new Konva.Text({
      text: placeholder,
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: COLORS.TEXT_MUTED,
      x: PADDING,
      y: textY,
      visible: this._model.value.length === 0,
      listening: false,
    })
    this.add(this._placeholderNode)

    this._composingNode = new Konva.Text({
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: COLORS.TEXT_MUTED,
      y: textY,
      visible: false,
      listening: false,
    })
    this.add(this._composingNode)

    this._cursorLine = new Konva.Rect({
      x: PADDING,
      y: textY,
      width: CURSOR_WIDTH,
      height: this._fs,
      fill: COLORS.TEXT_PRIMARY,
      visible: false,
      listening: false,
    })
    this.add(this._cursorLine)

    this._bg.on('mousedown touchstart', (e) => {
      e.cancelBubble = true
      const relX = this.getRelativePointerPosition()?.x ?? 0
      const pos = this._model.posFromX(relX - PADDING + this._scrollX)
      this._startEdit(pos)
      this._model.setSelection(pos, pos)
      this._dragging = true
      const stage = this.getStage()
      if (stage) {
        stage.on('mousemove touchmove', this._stageMoveFn)
        stage.on('mouseup touchend', this._stageUpFn)
      }
    })

    this._bg.on('tap', (e) => {
      e.cancelBubble = true
      const relX = this.getRelativePointerPosition()?.x ?? 0
      this._startEdit(this._model.posFromX(relX - PADDING + this._scrollX))
    })

    this._bg.on('dblclick', (e) => {
      e.cancelBubble = true
      this._startEdit()
      this._model.setSelection(0, this._model.value.length)
      this._syncDisplay()
      this._startBlink()
    })

    // Register the wheel handler exactly once. The handler is a no-op while
    // inactive, so keeping it bound for the element's lifetime is safe and
    // avoids listener accumulation across edit sessions.
    this.on('wheel', this._wheelFn)
  }

  getValue(): string {
    return this._model.value
  }

  setValue(value: string) {
    this._model.reset(value)
    this._scrollX = 0
    this._syncDisplay()
    this._onChange?.(this._model.value)
  }

  /**
   * Resize the input box (e.g. when its node is resized). Keeps the clip
   * region, background and scroll state in sync with the new width.
   */
  setWidth(width: number) {
    if (width === this._iw) return
    this._iw = width
    this._bg.width(width)
    this.clipWidth(width)
    this._syncScroll()
    this.getLayer()?.batchDraw()
  }

  _syncDisplay() {
    this._textNode.text(this._model.value)
    this._placeholderNode.visible(this._model.value.length === 0)
    this._syncCursor()
    this._syncSelection()
    const composingText = this._hidden.composingText
    if (composingText) {
      this._composingNode.text(composingText)
      this._composingNode.x(
        PADDING + this._model.cursorX(this._model.cursorPos),
      )
      this._composingNode.visible(true)
    } else {
      this._composingNode.visible(false)
    }
    this._syncScroll()
    this.getLayer()?.batchDraw()
  }

  _syncScroll() {
    const baseLocalX = this._model.cursorX(this._model.cursorPos)
    const compW = this._hidden.composing
      ? this._model.textWidth(this._hidden.composingText)
      : 0
    const cursorLocalX = baseLocalX + compW
    const viewW = this._iw - 2 * PADDING
    const totalW = this._model.textWidth(this._model.value)
    const maxScroll = Math.max(0, totalW - viewW)

    this._scrollX = Math.max(0, Math.min(maxScroll, this._scrollX))

    if (cursorLocalX - this._scrollX > viewW) {
      this._scrollX = cursorLocalX - viewW
    } else if (cursorLocalX - this._scrollX < 0) {
      this._scrollX = cursorLocalX
    }

    this._scrollX = Math.max(0, Math.min(maxScroll, this._scrollX))

    const off = -this._scrollX
    this._textNode.x(PADDING + off)
    this._placeholderNode.x(PADDING + off)
    this._cursorLine.x(PADDING + cursorLocalX + off)
    if (this._hidden.composingText) {
      this._composingNode.x(PADDING + baseLocalX + off)
    }
    const range = this._model.selRange()
    if (range) {
      this._selRect.x(PADDING + this._model.cursorX(range[0]) + off)
    }
  }

  _syncCursor() {
    if (!this._active) return
    const baseX = this._model.cursorX(this._model.cursorPos)
    const compW = this._hidden.composing
      ? this._model.textWidth(this._hidden.composingText)
      : 0
    this._cursorLine.x(PADDING + baseX + compW)
    this._syncHiddenPos()
  }

  _syncHiddenPos() {
    const abs = this.getAbsolutePosition()
    const scale = this.getAbsoluteScale()
    const baseX = this._model.cursorX(this._model.cursorPos)
    const x = abs.x + (PADDING + baseX - this._scrollX) * scale.x
    this._hidden.setPosition(x, this._cursorLine.getAbsolutePosition().y)
  }

  _syncSelection() {
    const range = this._model.selRange()
    if (!range) {
      this._selRect.visible(false)
    } else {
      const [s, e] = range
      const x0 = this._model.cursorX(s)
      const x1 = this._model.cursorX(e)
      this._selRect.x(PADDING + x0)
      this._selRect.width(x1 - x0)
      this._selRect.visible(true)
    }
  }

  _startBlink() {
    this._stopBlink()
    this._cursorLine.visible(true)
    this._blinkTimer = setInterval(() => {
      this._cursorLine.visible(!this._cursorLine.visible())
      this.getLayer()?.batchDraw()
    }, BLINK_INTERVAL)
  }

  _stopBlink() {
    if (this._blinkTimer !== null) {
      clearInterval(this._blinkTimer)
      this._blinkTimer = null
    }
    this._cursorLine.visible(false)
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

    this._bg.stroke(COLORS.ACCENT)

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
    this._selRect.visible(false)

    this._bg.stroke(this._borderColor)

    this._hidden.detach()
    this._scrollX = 0
    this._composingNode.visible(false)

    if (!commit) {
      this._model.revert()
    } else if (this._model.value !== this._model.committed) {
      this._model.commit()
      this._onChange?.(this._model.value)
    }

    this._model.clearSelection()
    this._syncDisplay()

    // Fully end the edit session: release the global keydown listener and
    // reset the active state so Enter/Escape/destroy stop editing instead
    // of leaving a stray bound listener that keeps mutating the value.
    this._unbindEvents()
    this._active = false
  }

  protected _onKeyDown(e: KeyboardEvent) {
    if (this._hidden.composing || e.isComposing || e.keyCode === 229) return
    handleInputKeyDown(this._model, e, this._keyEnv)
  }

  protected _deactivate() {
    this._stopEdit(true)
  }

  destroy(): this {
    // Revert any in-progress edit and fully release the session
    // (`_stopEdit` unbinds the window listener and resets `_active`).
    this._stopEdit(false)
    this._hidden.detach()
    return super.destroy()
  }
}
