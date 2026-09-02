import Konva from 'konva'
import {
  COLOR_FIELD_HEIGHT,
  COLOR_HUE_GAP,
  COLOR_HUE_WIDTH,
  CustomColorPicker,
} from './CustomColorPicker'
import { DEFAULT_THEME } from '../../../theme'
import type { GraphTheme } from '../../../theme'

const SWATCH_SIZE = 18
const GAP = 6
const PAD = 6
const COLS = 8

export const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ffffff',
  '#000000',
]

export function colorPanelWidth(): number {
  return PAD * 2 + COLS * SWATCH_SIZE + (COLS - 1) * GAP
}

export function colorPanelHeight(): number {
  return PAD + COLOR_FIELD_HEIGHT + GAP + SWATCH_SIZE + PAD
}

export interface ColorPanelConfig {
  colors: string[]
  value: string
  fontSize: number
  fontFamily: string
  /** Any color pick (preset swatch or custom SV/hue) — updates live. */
  onPick: (color: string) => void
}

export interface ColorPanelInit {
  above: boolean
  hostHeight: number
}

/**
 * Popup color panel: a custom SV + hue picker on top (see `CustomColorPicker`)
 * above a single row of preset swatches. Drawn at the top of the node layer so
 * it is never covered by other nodes (same strategy as the Select dropdown).
 *
 * The panel swallows pointerdown and click so stage-level gestures and the
 * active-element outside-click dismissal never fire while interacting inside
 * it — the panel is only dismissed by a click outside.
 */
export class ColorPanel extends Konva.Group {
  _onPick: (color: string) => void
  _custom: CustomColorPicker
  _swatches: Konva.Rect[] = []
  _value: string
  _bg: Konva.Rect
  _theme: GraphTheme

  constructor(config: ColorPanelConfig, theme: GraphTheme = DEFAULT_THEME) {
    super()
    this._onPick = config.onPick
    this._value = config.value
    this._theme = theme

    this.on('pointerdown', (e) => {
      e.cancelBubble = true
    })
    this.on('click tap', (e) => {
      e.cancelBubble = true
    })

    const width = colorPanelWidth()
    const height = colorPanelHeight()

    const bg = new Konva.Rect({
      width,
      height,
      fill: theme.colors.bg,
      stroke: theme.colors.border,
      strokeWidth: 1,
      cornerRadius: 2,
      shadowColor: '#000000',
      shadowBlur: 4,
      shadowOpacity: 0.15,
      shadowOffset: { x: 0, y: 2 },
    })
    this.add(bg)
    this._bg = bg

    const fieldWidth = width - PAD * 2 - COLOR_HUE_WIDTH - COLOR_HUE_GAP
    this._custom = new CustomColorPicker(
      {
        width: fieldWidth,
        value: config.value,
        onPick: (color) => this._setValue(color),
      },
      theme,
    )
    this._custom.position({ x: PAD, y: PAD })
    this.add(this._custom)

    const grid = new Konva.Group({ x: PAD, y: PAD + COLOR_FIELD_HEIGHT + GAP })
    this.add(grid)

    config.colors.forEach((color, i) => {
      const x = (i % COLS) * (SWATCH_SIZE + GAP)

      const swatch = new Konva.Rect({
        name: 'swatch',
        x,
        width: SWATCH_SIZE,
        height: SWATCH_SIZE,
        fill: color,
        stroke: theme.colors.border,
        strokeWidth: 1,
        cornerRadius: 3,
      })
      swatch.on('click tap', (e) => {
        e.cancelBubble = true
        this._setValue(color)
        this._custom.setValue(color)
      })
      this._swatches.push(swatch)
      grid.add(swatch)
    })

    this._updateHighlights()
  }

  /** Any pick (preset or custom) — update the current value and highlights. */
  _setValue(color: string) {
    this._value = color
    this._updateHighlights()
    this._onPick(color)
  }

  _updateHighlights() {
    for (const swatch of this._swatches) {
      const active = swatch.fill() === this._value
      swatch.stroke(
        active ? this._theme.colors.accent : this._theme.colors.border,
      )
      swatch.strokeWidth(active ? 2 : 1)
    }
    this.getLayer()?.batchDraw()
  }

  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    this._bg.fill(theme.colors.bg)
    this._bg.stroke(theme.colors.border)
    this._custom.applyTheme(theme)
    this._updateHighlights()
  }

  open(init: ColorPanelInit) {
    this.y(
      init.above ? -(colorPanelHeight() + 2) : init.hostHeight + 2,
    )
  }
}
