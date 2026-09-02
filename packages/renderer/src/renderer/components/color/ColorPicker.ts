import Konva from 'konva'
import { resetStageCursor, setStageCursor } from '../../cursor'
import { FormElement } from '../FormElement'
import {
  DEFAULT_HEIGHT,
  type BaseFormConfig,
} from '../shared'
import {
  ColorPanel,
  PRESET_COLORS,
  colorPanelHeight,
} from './ColorPanel'
import { DEFAULT_THEME } from '../../../theme'
import type { GraphTheme } from '../../../theme'

const SWATCH_SIZE = 14
const TEXT_GAP = 6

export interface ColorPickerConfig extends BaseFormConfig {
  pickerWidth: number
  pickerHeight?: number
  value?: string
  colors?: string[]
  shape?: 'circle' | 'rect'
  /** Live preview while the panel is open (every pick). */
  onChange?: (color: string) => void
  /** Fired once with the final value when the picker is dismissed. */
  onCommit?: (color: string) => void
}

export class ColorPicker extends FormElement {
  _swatch: Konva.Shape
  _text: Konva.Text
  _panel: ColorPanel | null = null

  _pw: number
  _ph: number
  _val: string
  _colors: string[]
  _shape: 'circle' | 'rect'
  _onChange?: (color: string) => void
  _onCommit?: (color: string) => void
  /** Whether a color was actually picked since the panel opened. */
  _picked = false

  constructor(config: ColorPickerConfig, theme?: GraphTheme) {
    const t = theme ?? DEFAULT_THEME
    const {
      pickerWidth,
      pickerHeight = DEFAULT_HEIGHT,
      value = '#ffffff',
      colors = PRESET_COLORS,
      shape = 'circle',
      onChange,
      onCommit,
      ...rest
    } = config
    super(rest, t)

    this._pw = pickerWidth
    this._ph = pickerHeight
    this._val = value
    this._colors = colors
    this._shape = shape
    this._onChange = onChange
    this._onCommit = onCommit

    this._swatch = this._createSwatch()
    this.add(this._swatch)

    this._text = new Konva.Text({
      x: SWATCH_SIZE + TEXT_GAP,
      y: (pickerHeight - this._fs) / 2,
      text: value.toUpperCase(),
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: t.colors.textPrimary,
      width: Math.max(0, pickerWidth - SWATCH_SIZE - TEXT_GAP),
      listening: false,
    })
    this.add(this._text)

    this._swatch.on('click tap', this._toggle)
  }

  getValue(): string {
    return this._val
  }

  /** Whether the picker panel is currently open. */
  get active(): boolean {
    return this._active
  }

  setValue(color: string, silent = false) {
    if (color === this._val) return
    this._val = color
    this._swatch.fill(color)
    this._text.text(color.toUpperCase())
    this.getLayer()?.batchDraw()
    if (!silent) {
      this._picked = true
      this._onChange?.(color)
    }
  }

  setColors(colors: string[]) {
    this._colors = colors
  }

  setWidth(width: number) {
    if (width === this._pw) return
    this._pw = width
    this._text.width(Math.max(0, width - SWATCH_SIZE - TEXT_GAP))
    this.getLayer()?.batchDraw()
  }

  destroy(): this {
    this.deactivate()
    resetStageCursor(this)
    return super.destroy()
  }

  _createSwatch(): Konva.Circle | Konva.Rect {
    const y = this._ph / 2

    if (this._shape === 'rect') {
      const rect = new Konva.Rect({
        name: 'swatch',
        x: 0,
        y: y - SWATCH_SIZE / 2,
        width: SWATCH_SIZE,
        height: SWATCH_SIZE,
        cornerRadius: 3,
        fill: this._val,
        stroke: this._borderColor,
        strokeWidth: 1,
      })
      this._attachCursor(rect)
      return rect
    }

    const circle = new Konva.Circle({
      name: 'swatch',
      x: SWATCH_SIZE / 2,
      y,
      radius: SWATCH_SIZE / 2,
      fill: this._val,
      stroke: this._borderColor,
      strokeWidth: 1,
    })
    this._attachCursor(circle)
    return circle
  }

  _attachCursor(node: Konva.Node) {
    node.on('mouseover pointerover', (evt) => {
      setStageCursor(evt.target, 'pointer')
    })
    node.on('mouseout pointerout', (evt) => {
      resetStageCursor(evt.target)
    })
  }

  _toggle = (e: Konva.KonvaEventObject<Event>) => {
    e.cancelBubble = true
    if (this._active) {
      this.deactivate()
    } else {
      this._openPanel()
    }
  }

  _openPanel() {
    if (this._active) return
    this._activate()
    this._swatch.stroke(this._theme.colors.accent)
    this._picked = false

    this._mountPanel()
    this.getLayer()?.batchDraw()
  }

  _mountPanel() {
    this._unmountPanel()

    const panel = new ColorPanel(
      {
        colors: this._colors,
        value: this._val,
        fontSize: this._fs,
        fontFamily: this._ff,
        onPick: (color) => this.setValue(color),
      },
      this._theme,
    )
    panel.open({
      above: this._shouldOpenAbove(),
      hostHeight: this._ph,
    })
    this._panel = panel

    // Render the popup at the top of the node layer instead of inside the
    // node's subtree, so it is never covered by other (higher z-order) nodes.
    const layer = this.getLayer()
    if (layer) {
      this.add(panel)
      const absPos = panel.getAbsolutePosition()
      layer.add(panel)
      panel.setAbsolutePosition(absPos)
    } else {
      this.add(panel)
    }
  }

  _unmountPanel() {
    if (this._panel) {
      this._panel.destroy()
      this._panel = null
    }
  }

  _shouldOpenAbove(): boolean {
    const stage = this.getStage()
    if (!stage) return false

    const panelHeight = colorPanelHeight()
    const scale = stage.scaleY()
    const absY = this.getAbsolutePosition().y
    const spaceBelow = stage.height() - (absY + this._ph * scale)
    const spaceAbove = absY
    return panelHeight * scale > spaceBelow && spaceAbove > spaceBelow
  }

  _close() {
    if (!this._active) return

    this._swatch.stroke(this._borderColor)
    this._unmountPanel()
    this.getLayer()?.batchDraw()
    if (this._picked) {
      this._onCommit?.(this._val)
    }
    this._picked = false
  }

  protected _deactivate(): void {
    this._close()
  }

  protected _onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      // Full `deactivate()` (not just `_close()`) so the widget returns to the
      // inactive state — otherwise the next click would toggle it closed
      // instead of reopening the panel.
      this.deactivate()
    }
  }

  applyTheme(theme: GraphTheme): void {
    super.applyTheme(theme)

    this._text.fill(theme.colors.textPrimary)
    this._text.fontFamily(theme.fonts.family)
    this._swatch.stroke(
      this._active ? theme.colors.accent : this._borderColor,
    )
    this._panel?.applyTheme?.(theme)

    // Re-center the value text for the new font size.
    this._text.y((this._ph - this._fs) / 2)
    this._text.fontSize(this._fs)
    this.getLayer()?.batchDraw()
  }
}
