import Konva from 'konva'
import { COLORS } from '../constants'
import { Input } from './input'
import { DEFAULT_FONT_FAMILY, PADDING, measureTextWidth } from './shared'

export interface EditableTextConfig {
  /** Static display text. */
  text: string
  fontSize?: number
  fontFamily?: string
  fill?: string
  x?: number
  y?: number
  name?: string
  /** Inline editor width; a function is recomputed when the edit opens. */
  inputWidth?: number | (() => number)
  inputHeight?: number
  inputFill?: string
  onChange?: (value: string) => void
  onStopEdit?: () => void
}

/**
 * A static Konva text that flips to an inline `Input` editor on double-click.
 * Owns the edit session: hides the static text while editing, restores it on
 * commit/cancel, and tears the editor down on destroy.
 */
export class EditableText extends Konva.Group {
  _textNode: Konva.Text
  _input: Input | null = null

  _fs: number
  _ff: string
  _inputWidth?: number | (() => number)
  _inputHeight: number
  _inputFill: string
  _onChange?: (value: string) => void
  _onStopEdit?: () => void

  constructor(config: EditableTextConfig) {
    const {
      text,
      fontSize = 13,
      fontFamily = DEFAULT_FONT_FAMILY,
      fill = COLORS.TEXT_PRIMARY,
      x = 0,
      y = 0,
      name,
      inputWidth,
      inputHeight = 18,
      inputFill = COLORS.BG,
      onChange,
      onStopEdit,
    } = config

    super({ x, y })

    this._fs = fontSize
    this._ff = fontFamily
    this._inputWidth = inputWidth
    this._inputHeight = inputHeight
    this._inputFill = inputFill
    this._onChange = onChange
    this._onStopEdit = onStopEdit

    this._textNode = new Konva.Text({
      text,
      fontSize,
      fontFamily,
      fill,
      name,
    })
    this.add(this._textNode)
    this._textNode.on('dblclick', (e) => {
      e.cancelBubble = true
      this.startEdit()
    })
  }

  /** Update the static display text. */
  setText(text: string): void {
    this._textNode.text(text)
  }

  /** Open the inline editor over the static text. */
  startEdit(): void {
    if (this._input) return

    const inputWidth =
      typeof this._inputWidth === 'function'
        ? this._inputWidth()
        : (this._inputWidth ??
          Math.max(
            60,
            measureTextWidth(this._textNode.text(), this._fs, this._ff) +
              2 * PADDING,
          ))

    const input = new Input({
      // Offset so the input's own text (inset by PADDING, vertically
      // centered) lands exactly where the static text is drawn.
      x: -PADDING,
      y: -(this._inputHeight - this._fs) / 2,
      inputWidth,
      inputHeight: this._inputHeight,
      value: this._textNode.text(),
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: this._inputFill,
      onChange: (value) => this._onChange?.(value),
      onStopEdit: () => this._stopEdit(),
    })

    this._input = input
    this._textNode.visible(false)
    this.add(input)
    this.getLayer()?.batchDraw()
    input._startEdit()
    input.selectAll()
  }

  _stopEdit(): void {
    if (!this._input) return
    const input = this._input
    this._input = null
    this._textNode.visible(true)
    input.destroy()
    this.getLayer()?.batchDraw()
  }

  destroy(): this {
    this._stopEdit()
    return super.destroy()
  }
}
