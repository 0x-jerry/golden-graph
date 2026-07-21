import Konva from 'konva'
import { COLORS } from '../constants'
import { FormElement } from './FormElement'
import {
  DEFAULT_HEIGHT,
  PADDING,
  measureTextWidth,
  type BaseFormConfig,
} from './shared'

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
  declare _bg: Konva.Rect
  declare _textNode: Konva.Text
  declare _placeholderNode: Konva.Text
  declare _cursorLine: Konva.Rect
  declare _selRect: Konva.Rect
  declare _composingNode: Konva.Text

  declare _val: string
  declare _committed: string
  declare _composingText: string
  declare _cursorPos: number
  declare _selAnchor: number
  declare _composing: boolean
  declare _scrollX: number
  declare _blinkTimer: ReturnType<typeof setInterval> | null

  declare _iw: number
  declare _ih: number
  declare _onChange?: (value: string) => void
  declare _beforeChange?: (value: string) => string

  declare _compBase: string
  declare _hiddenInput: HTMLInputElement | null
  declare _dragging: boolean
  declare _didDrag: boolean
  declare _wheelFn: (e: Konva.KonvaEventObject<WheelEvent>) => void
  declare _stageMoveFn: (e: Konva.KonvaEventObject<MouseEvent>) => void
  declare _stageUpFn: (e: Konva.KonvaEventObject<MouseEvent>) => void
  declare _compStartFn: (e: CompositionEvent) => void
  declare _compEndFn: (e: CompositionEvent) => void
  declare _hiddenInputFn: (e: Event) => void

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
    this._beforeChange = beforeChange
    this._val = beforeChange ? beforeChange(value) : value
    this._committed = this._val
    this._cursorPos = this._val.length
    this._selAnchor = -1
    this._composing = false
    this._composingText = ''
    this._compBase = ''
    this._scrollX = 0
    this._blinkTimer = null
    this._hiddenInput = null
    this._dragging = false
    this._didDrag = false

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
      text: value,
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
      visible: value.length === 0,
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
      const pos = this._posFromX(relX - PADDING + this._scrollX)
      this._startEdit(pos)
      this._selAnchor = pos
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
      this._startEdit(this._posFromX(relX - PADDING + this._scrollX))
    })

    this._bg.on('dblclick', (e) => {
      e.cancelBubble = true
      this._startEdit()
      this._cursorPos = this._val.length
      this._selAnchor = 0
      this._syncDisplay()
      this._startBlink()
    })

    this._wheelFn = (e: Konva.KonvaEventObject<WheelEvent>) => {
      if (!this._active) return
      const totalW = this._measure(this._val)
      const maxScroll = Math.max(0, totalW + 2 * PADDING - this._iw)
      if (maxScroll <= 0) return
      e.evt.preventDefault()
      this._scrollX = Math.max(0, Math.min(maxScroll, this._scrollX + e.evt.deltaX))
      this._syncDisplay()
    }

    this._stageMoveFn = () => {
      if (!this._dragging) return
      this._didDrag = true
      const relX = this.getRelativePointerPosition()?.x ?? 0
      this._cursorPos = this._posFromX(relX - PADDING + this._scrollX)
      this._syncDisplay()
      this._startBlink()
    }

    this._stageUpFn = () => {
      this._dragging = false
      const stage = this.getStage()
      if (stage) {
        stage.off('mousemove touchmove', this._stageMoveFn)
        stage.off('mouseup touchend', this._stageUpFn)
      }
    }

    this._compStartFn = () => {
      this._composing = true
      this._compBase = this._hiddenInput?.value ?? ''
    }
    this._compEndFn = () => {
      this._composing = false
      if (this._hiddenInput) {
        const text = this._hiddenInput.value.slice(this._compBase.length)
        this._hiddenInput.value = ''
        this._compBase = ''
        this._composingText = ''
        if (text) {
          this._insertText(text)
          this._syncDisplay()
          this._startBlink()
        }
      }
    }
    this._hiddenInputFn = (e: Event) => {
      if (this._composing) {
        const input = e.target as HTMLInputElement
        this._composingText = input.value.slice(this._compBase.length)
        this._syncDisplay()
        return
      }
      const input = e.target as HTMLInputElement
      if (input.value) {
        this._insertText(input.value)
        input.value = ''
        this._syncDisplay()
        this._startBlink()
      }
    }
  }

  getValue(): string {
    return this._val
  }

  setValue(value: string) {
    this._setVal(value)
    this._committed = this._val
    this._cursorPos = this._val.length
    this._selAnchor = -1
    this._scrollX = 0
    this._syncDisplay()
    this._onChange?.(this._val)
  }

  _setVal(next: string) {
    this._val = this._beforeChange ? this._beforeChange(next) : next
    if (this._cursorPos > this._val.length) {
      this._cursorPos = this._val.length
    }
  }

  _measure(str: string): number {
    return measureTextWidth(str, this._fs, this._ff)
  }

  _cursorX(pos: number): number {
    return this._measure(this._val.slice(0, pos))
  }

  _posFromX(x: number): number {
    if (x <= 0) return 0
    const len = this._val.length
    for (let i = 0; i < len; i++) {
      const w = this._measure(this._val.slice(0, i + 1))
      if (x < w) {
        const prev = this._measure(this._val.slice(0, i))
        return x - prev < w - x ? i : i + 1
      }
    }
    return len
  }

  _selRange(): [number, number] | null {
    if (this._selAnchor < 0 || this._selAnchor === this._cursorPos) return null
    return this._selAnchor < this._cursorPos
      ? [this._selAnchor, this._cursorPos]
      : [this._cursorPos, this._selAnchor]
  }

  _deleteSelection(): boolean {
    const range = this._selRange()
    if (!range) return false
    const [s, e] = range
    const next = this._val.slice(0, s) + this._val.slice(e)
    this._cursorPos = s
    this._selAnchor = -1
    this._setVal(next)
    return true
  }

  _insertText(text: string) {
    this._deleteSelection()
    const pos = this._cursorPos
    const next = this._val.slice(0, pos) + text + this._val.slice(pos)
    this._setVal(next)
    this._cursorPos = Math.min(pos + text.length, this._val.length)
    this._selAnchor = -1
  }

  _syncDisplay() {
    this._textNode.text(this._val)
    this._placeholderNode.visible(this._val.length === 0)
    this._syncCursor()
    this._syncSelection()
    if (this._composingText) {
      this._composingNode.text(this._composingText)
      this._composingNode.x(PADDING + this._cursorX(this._cursorPos))
      this._composingNode.visible(true)
    } else {
      this._composingNode.visible(false)
    }
    this._syncScroll()
    this.getLayer()?.batchDraw()
  }

  _syncScroll() {
    const baseLocalX = this._cursorX(this._cursorPos)
    const compW = this._composing ? this._measure(this._composingText) : 0
    const cursorLocalX = baseLocalX + compW
    const viewW = this._iw - 2 * PADDING
    const totalW = this._measure(this._val)
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
    if (this._composingText) {
      this._composingNode.x(PADDING + baseLocalX + off)
    }
    const range = this._selRange()
    if (range) {
      this._selRect.x(PADDING + this._cursorX(range[0]) + off)
    }
  }

  _syncCursor() {
    if (!this._active) return
    const baseX = this._cursorX(this._cursorPos)
    const compW = this._composing ? this._measure(this._composingText) : 0
    this._cursorLine.x(PADDING + baseX + compW)
    this._syncHiddenPos()
  }

  _syncHiddenPos() {
    if (!this._hiddenInput) return
    const abs = this.getAbsolutePosition()
    const scale = this.getAbsoluteScale()
    const baseX = this._cursorX(this._cursorPos)
    const x = abs.x + (PADDING + baseX - this._scrollX) * scale.x
    this._hiddenInput.style.left = `${x}px`
    this._hiddenInput.style.top = `${this._cursorLine.getAbsolutePosition().y}px`
  }

  _syncSelection() {
    const range = this._selRange()
    if (!range) {
      this._selRect.visible(false)
    } else {
      const [s, e] = range
      const x0 = this._cursorX(s)
      const x1 = this._cursorX(e)
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
        this._cursorPos = pos
        this._selAnchor = -1
        this._syncDisplay()
        this._startBlink()
      }
      return
    }

    this._activate()
    this._committed = this._val
    this._cursorPos = pos ?? this._val.length
    this._selAnchor = -1

    this._bg.stroke(COLORS.ACCENT)

    const stage = this.getStage()
    if (stage) {
      this._hiddenInput = document.createElement('input')
      this._hiddenInput.style.cssText =
        'position:absolute;opacity:0;width:1px;height:1px;'
      this._hiddenInput.setAttribute('autocomplete', 'off')
      stage.container().appendChild(this._hiddenInput)
      this._syncHiddenPos()
      this._hiddenInput.focus()
      this._hiddenInput.addEventListener('compositionstart', this._compStartFn)
      this._hiddenInput.addEventListener('compositionend', this._compEndFn)
      this._hiddenInput.addEventListener('input', this._hiddenInputFn)
    }

    this.on('wheel', this._wheelFn)

    this._syncDisplay()
    this._startBlink()
  }

  _stopEdit(commit: boolean) {
    if (!this._active) return

    this._stopBlink()
    this._selRect.visible(false)

    this._bg.stroke(this._borderColor)

    this.on('wheel', this._wheelFn)
    this._composing = false
    this._composingText = ''
    this._compBase = ''
    this._scrollX = 0
    this._composingNode.visible(false)

    if (this._hiddenInput) {
      this._hiddenInput.removeEventListener('compositionstart', this._compStartFn)
      this._hiddenInput.removeEventListener('compositionend', this._compEndFn)
      this._hiddenInput.removeEventListener('input', this._hiddenInputFn)
      this._hiddenInput.remove()
      this._hiddenInput = null
    }

    if (!commit) {
      this._val = this._committed
    } else if (this._val !== this._committed) {
      this._committed = this._val
      this._onChange?.(this._val)
    }

    this._selAnchor = -1
    this._syncDisplay()
    this._deactivate()
  }

  protected _onKeyDown(e: KeyboardEvent) {
    if (this._composing || e.isComposing || e.keyCode === 229) return

    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey

    if (e.key === 'Enter') {
      e.preventDefault()
      this._stopEdit(true)
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      this._stopEdit(false)
      return
    }

    if (this._handleEditingKey(e, ctrl, shift)) return

    if (e.key.length === 1 && !ctrl && !e.altKey) {
      e.preventDefault()
      this._insertText(e.key)
      if (this._hiddenInput) this._hiddenInput.value = ''
      this._syncDisplay()
      this._startBlink()
    }
  }

  private _handleEditingKey(e: KeyboardEvent, ctrl: boolean, shift: boolean): boolean {
    if (e.key === 'Backspace') return this._handleBackspace(e)
    if (e.key === 'Delete') return this._handleDelete(e)
    if (e.key === 'ArrowLeft') return this._handleArrowLeft(e, shift)
    if (e.key === 'ArrowRight') return this._handleArrowRight(e, shift)
    if (e.key === 'Home') return this._handleHome(e, shift)
    if (e.key === 'End') return this._handleEnd(e, shift)
    if (ctrl && e.key === 'a') return this._handleSelectAll(e)
    if (ctrl && e.key === 'c') return this._handleCopy(e)
    if (ctrl && e.key === 'x') return this._handleCut(e)
    if (ctrl && e.key === 'v') return this._handlePaste(e)
    return false
  }

  private _handleBackspace(e: KeyboardEvent): boolean {
    e.preventDefault()
    if (!this._deleteSelection()) {
      if (this._cursorPos > 0) {
        const pos = this._cursorPos
        this._setVal(this._val.slice(0, pos - 1) + this._val.slice(pos))
        this._cursorPos = Math.min(pos - 1, this._val.length)
      }
    }
    this._syncDisplay()
    this._startBlink()
    return true
  }

  private _handleDelete(e: KeyboardEvent): boolean {
    e.preventDefault()
    if (!this._deleteSelection()) {
      const pos = this._cursorPos
      this._setVal(this._val.slice(0, pos) + this._val.slice(pos + 1))
      this._cursorPos = Math.min(pos, this._val.length)
    }
    this._syncDisplay()
    this._startBlink()
    return true
  }

  private _handleArrowLeft(e: KeyboardEvent, shift: boolean): boolean {
    e.preventDefault()
    if (shift) {
      if (this._selAnchor < 0) this._selAnchor = this._cursorPos
      if (this._cursorPos > 0) {
        this._cursorPos--
      }
    } else {
      const range = this._selRange()
      this._selAnchor = -1
      if (range) {
        this._cursorPos = range[0]
      } else if (this._cursorPos > 0) {
        this._cursorPos--
      }
    }
    this._syncDisplay()
    this._startBlink()
    return true
  }

  private _handleArrowRight(e: KeyboardEvent, shift: boolean): boolean {
    e.preventDefault()
    if (shift) {
      if (this._selAnchor < 0) this._selAnchor = this._cursorPos
      if (this._cursorPos < this._val.length) {
        this._cursorPos++
      }
    } else {
      const range = this._selRange()
      this._selAnchor = -1
      if (range) {
        this._cursorPos = range[1]
      } else if (this._cursorPos < this._val.length) {
        this._cursorPos++
      }
    }
    this._syncDisplay()
    this._startBlink()
    return true
  }

  private _handleHome(e: KeyboardEvent, shift: boolean): boolean {
    e.preventDefault()
    if (shift) {
      if (this._selAnchor < 0) this._selAnchor = this._cursorPos
    } else {
      this._selAnchor = -1
    }
    this._cursorPos = 0
    this._syncDisplay()
    this._startBlink()
    return true
  }

  private _handleEnd(e: KeyboardEvent, shift: boolean): boolean {
    e.preventDefault()
    if (shift) {
      if (this._selAnchor < 0) this._selAnchor = this._cursorPos
    } else {
      this._selAnchor = -1
    }
    this._cursorPos = this._val.length
    this._syncDisplay()
    this._startBlink()
    return true
  }

  private _handleSelectAll(e: KeyboardEvent): boolean {
    e.preventDefault()
    this._cursorPos = this._val.length
    this._selAnchor = 0
    this._syncDisplay()
    this._startBlink()
    return true
  }

  private _handleCopy(e: KeyboardEvent): boolean {
    e.preventDefault()
    const range = this._selRange()
    if (range) {
      navigator.clipboard.writeText(this._val.slice(range[0], range[1]))
    }
    return true
  }

  private _handleCut(e: KeyboardEvent): boolean {
    e.preventDefault()
    const range = this._selRange()
    if (range) {
      navigator.clipboard.writeText(this._val.slice(range[0], range[1]))
      this._deleteSelection()
      this._syncDisplay()
      this._startBlink()
    }
    return true
  }

  private _handlePaste(e: KeyboardEvent): boolean {
    e.preventDefault()
    navigator.clipboard.readText().then((text) => {
      if (text) {
        this._insertText(text)
        this._syncDisplay()
        this._startBlink()
      }
    }).catch(() => {})
    return true
  }

  protected _onStageClick(): void {
    if (this._didDrag) {
      this._didDrag = false
      return
    }
    this._stopEdit(true)
  }

  protected _onOutsideClick(): void {
    this._stopEdit(true)
  }

  destroy(): this {
    if (this._active) {
      this._stopEdit(false)
    }
    this._hiddenInput = null
    return super.destroy()
  }
}
