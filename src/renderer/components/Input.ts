import Konva from 'konva'
import type { GroupConfig } from 'konva/lib/Group'
import { COLORS } from '../constants'

const DEFAULT_HEIGHT = 24
const DEFAULT_FONT_SIZE = 12
const DEFAULT_FONT_FAMILY = 'Arial, sans-serif'
const PADDING = 4
const CURSOR_WIDTH = 1
const BLINK_INTERVAL = 530

let measureCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null

function getMeasureCtx(): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  if (!measureCtx) {
    if (typeof OffscreenCanvas !== 'undefined') {
      measureCtx = new OffscreenCanvas(0, 0).getContext('2d')!
    } else {
      measureCtx = document.createElement('canvas').getContext('2d')!
    }
  }
  return measureCtx
}

function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  const ctx = getMeasureCtx()
  ctx.font = `${fontSize}px ${fontFamily}`
  return ctx.measureText(text).width
}

export interface InputConfig extends GroupConfig {
  inputWidth: number
  inputHeight?: number
  value?: string
  placeholder?: string
  fontSize?: number
  fontFamily?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  cornerRadius?: number
  onChange?: (value: string) => void
  beforeChange?: (value: string) => string
}

export class Input extends Konva.Group {
  declare _bg: Konva.Rect
  declare _textNode: Konva.Text
  declare _placeholderNode: Konva.Text
  declare _cursorLine: Konva.Rect
  declare _selRect: Konva.Rect

  declare _val: string
  declare _committed: string
  declare _cursorPos: number
  declare _selAnchor: number
  declare _editing: boolean
  declare _blinkTimer: ReturnType<typeof setInterval> | null

  declare _iw: number
  declare _ih: number
  declare _fs: number
  declare _ff: string
  declare _borderColor: string
  declare _onChange?: (value: string) => void
  declare _beforeChange?: (value: string) => string

  declare _keydownFn: (e: KeyboardEvent) => void
  declare _stageClickFn: (e: Konva.KonvaEventObject<MouseEvent>) => void
  declare _docClickFn: (e: MouseEvent) => void

  constructor(config: InputConfig) {
    const {
      inputWidth,
      inputHeight = DEFAULT_HEIGHT,
      value = '',
      placeholder = '',
      fontSize = DEFAULT_FONT_SIZE,
      fontFamily = DEFAULT_FONT_FAMILY,
      fill = COLORS.BG,
      stroke = COLORS.BORDER,
      strokeWidth = 1,
      cornerRadius = 2,
      onChange,
      beforeChange,
      ...rest
    } = config

    super(rest)

    this._iw = inputWidth
    this._ih = inputHeight
    this._fs = fontSize
    this._ff = fontFamily
    this._borderColor = stroke
    this._onChange = onChange
    this._beforeChange = beforeChange
    this._val = beforeChange ? beforeChange(value) : value
    this._committed = this._val
    this._cursorPos = value.length
    this._selAnchor = -1
    this._editing = false
    this._blinkTimer = null

    const textY = (inputHeight - fontSize) / 2

    this._bg = new Konva.Rect({
      width: inputWidth,
      height: inputHeight,
      fill,
      stroke,
      strokeWidth,
      cornerRadius,
    })
    this.add(this._bg)

    this._selRect = new Konva.Rect({
      x: PADDING,
      y: textY,
      width: 0,
      height: fontSize,
      fill: COLORS.SELECTION_FILL,
      visible: false,
      listening: false,
    })
    this.add(this._selRect)

    this._textNode = new Konva.Text({
      text: value,
      fontSize,
      fontFamily,
      fill: COLORS.TEXT_PRIMARY,
      x: PADDING,
      y: textY,
      listening: false,
    })
    this.add(this._textNode)

    this._placeholderNode = new Konva.Text({
      text: placeholder,
      fontSize,
      fontFamily,
      fill: COLORS.TEXT_MUTED,
      x: PADDING,
      y: textY,
      visible: value.length === 0,
      listening: false,
    })
    this.add(this._placeholderNode)

    this._cursorLine = new Konva.Rect({
      x: PADDING,
      y: textY,
      width: CURSOR_WIDTH,
      height: fontSize,
      fill: COLORS.TEXT_PRIMARY,
      visible: false,
      listening: false,
    })
    this.add(this._cursorLine)

    this._bg.on('click tap', (e) => {
      e.cancelBubble = true
      const relX = this.getRelativePointerPosition()?.x ?? 0
      this._startEdit(this._posFromX(relX - PADDING))
    })

    this._keydownFn = this._onKeyDown.bind(this)
    this._stageClickFn = () => {
      if (this._editing) {
        this._stopEdit(true)
      }
    }
    this._docClickFn = (e: MouseEvent) => {
      if (!this._editing) return
      const stage = this.getStage()
      if (!stage) return
      if (!stage.container().contains(e.target as globalThis.Node)) {
        this._stopEdit(true)
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
    this.getLayer()?.batchDraw()
  }

  _syncCursor() {
    if (!this._editing) return
    this._cursorLine.x(PADDING + this._cursorX(this._cursorPos))
    this._cursorLine.visible(true)
  }

  _syncSelection() {
    const range = this._selRange()
    if (!range) {
      this._selRect.visible(false)
      return
    }
    const [s, e] = range
    const x0 = this._cursorX(s)
    const x1 = this._cursorX(e)
    this._selRect.x(PADDING + x0)
    this._selRect.width(x1 - x0)
    this._selRect.visible(true)
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
    if (this._editing) {
      if (pos !== undefined) {
        this._cursorPos = pos
        this._selAnchor = -1
        this._syncCursor()
        this._syncSelection()
        this._startBlink()
        this.getLayer()?.batchDraw()
      }
      return
    }

    this._editing = true
    this._committed = this._val
    this._cursorPos = pos ?? this._val.length
    this._selAnchor = -1

    this._bg.stroke(COLORS.ACCENT)

    const stage = this.getStage()
    if (stage) {
      stage.on('click tap', this._stageClickFn)
      const container = stage.container()
      container.setAttribute('tabindex', '0')
      container.focus()
    }

    window.addEventListener('keydown', this._keydownFn)
    document.addEventListener('mousedown', this._docClickFn, true)

    this._syncDisplay()
    this._startBlink()
  }

  _stopEdit(commit: boolean) {
    if (!this._editing) return
    this._editing = false

    this._stopBlink()
    this._selRect.visible(false)

    this._bg.stroke(this._borderColor)

    window.removeEventListener('keydown', this._keydownFn)
    document.removeEventListener('mousedown', this._docClickFn, true)

    const stage = this.getStage()
    if (stage) {
      stage.off('click tap', this._stageClickFn)
    }

    if (!commit) {
      this._val = this._committed
    } else if (this._val !== this._committed) {
      this._committed = this._val
      this._onChange?.(this._val)
    }

    this._syncDisplay()
  }

  _onKeyDown(e: KeyboardEvent) {
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

    if (e.key === 'Backspace') {
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
      return
    }

    if (e.key === 'Delete') {
      e.preventDefault()
      if (!this._deleteSelection()) {
        const pos = this._cursorPos
        this._setVal(this._val.slice(0, pos) + this._val.slice(pos + 1))
        this._cursorPos = Math.min(pos, this._val.length)
      }
      this._syncDisplay()
      this._startBlink()
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (shift) {
        if (this._selAnchor < 0) this._selAnchor = this._cursorPos
      } else {
        this._selAnchor = -1
      }
      if (this._cursorPos > 0) {
        if (!shift) {
          const range = this._selRange()
          if (range) {
            this._cursorPos = range[0]
          } else {
            this._cursorPos--
          }
        } else {
          this._cursorPos--
        }
      } else if (!shift) {
        this._selAnchor = -1
      }
      this._syncCursor()
      this._syncSelection()
      this._startBlink()
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (shift) {
        if (this._selAnchor < 0) this._selAnchor = this._cursorPos
      } else {
        this._selAnchor = -1
      }
      if (this._cursorPos < this._val.length) {
        if (!shift) {
          const range = this._selRange()
          if (range) {
            this._cursorPos = range[1]
          } else {
            this._cursorPos++
          }
        } else {
          this._cursorPos++
        }
      } else if (!shift) {
        this._selAnchor = -1
      }
      this._syncCursor()
      this._syncSelection()
      this._startBlink()
      return
    }

    if (e.key === 'Home') {
      e.preventDefault()
      if (shift) {
        if (this._selAnchor < 0) this._selAnchor = this._cursorPos
      } else {
        this._selAnchor = -1
      }
      this._cursorPos = 0
      this._syncCursor()
      this._syncSelection()
      this._startBlink()
      return
    }

    if (e.key === 'End') {
      e.preventDefault()
      if (shift) {
        if (this._selAnchor < 0) this._selAnchor = this._cursorPos
      } else {
        this._selAnchor = -1
      }
      this._cursorPos = this._val.length
      this._syncCursor()
      this._syncSelection()
      this._startBlink()
      return
    }

    if (ctrl && e.key === 'a') {
      e.preventDefault()
      this._cursorPos = this._val.length
      this._selAnchor = 0
      this._syncCursor()
      this._syncSelection()
      this._startBlink()
      return
    }

    if (ctrl && e.key === 'c') {
      e.preventDefault()
      const range = this._selRange()
      if (range) {
        navigator.clipboard.writeText(this._val.slice(range[0], range[1]))
      }
      return
    }

    if (ctrl && e.key === 'x') {
      e.preventDefault()
      const range = this._selRange()
      if (range) {
        navigator.clipboard.writeText(this._val.slice(range[0], range[1]))
        this._deleteSelection()
        this._syncDisplay()
        this._startBlink()
      }
      return
    }

    if (ctrl && e.key === 'v') {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        if (text) {
          this._insertText(text)
          this._syncDisplay()
          this._startBlink()
        }
      })
      return
    }

    if (e.key.length === 1 && !ctrl && !e.altKey) {
      e.preventDefault()
      this._insertText(e.key)
      this._syncDisplay()
      this._startBlink()
    }
  }

  destroy(): this {
    if (this._editing) {
      this._stopEdit(false)
    }
    return super.destroy()
  }
}
