import Konva from 'konva'
import { COLORS } from '../../constants'

export const COLOR_FIELD_HEIGHT = 120
export const COLOR_HUE_WIDTH = 12
export const COLOR_HUE_GAP = 6

const RAINBOW_STOPS = [
  0, '#ff0000', 0.1667, '#ffff00', 0.3333, '#00ff00', 0.5, '#00ffff',
  0.6667, '#0000ff', 0.8333, '#ff00ff', 1, '#ff0000',
]

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function hsvToHex(h: number, s: number, v: number): string {
  h = ((h % 360) + 360) % 360
  s = clamp01(s)
  v = clamp01(v)

  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c

  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let value = hex.trim().replace(/^#/, '')
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    return { h: 0, s: 0, v: 1 }
  }

  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / d) % 6)
    } else if (max === g) {
      h = 60 * ((b - r) / d + 2)
    } else {
      h = 60 * ((r - g) / d + 4)
    }
  }
  if (h < 0) h += 360

  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export interface CustomColorPickerConfig {
  /** SV field width — fills the available container width. */
  width: number
  value: string
  onPick: (color: string) => void
}

/**
 * Custom color picker built entirely from raw Konva rects (no native color
 * input element): a saturation/value field stretched to the container width
 * plus a vertical hue bar. Picking updates the caller live through `onPick`;
 * drag is handled on the stage so it keeps working even when the pointer
 * leaves the field.
 */
export class CustomColorPicker extends Konva.Group {
  _onPick: (color: string) => void
  _width: number

  _hue = 0
  _sat = 0
  _val = 1

  _svBase: Konva.Rect
  _svField: Konva.Rect
  _svMarker: Konva.Circle
  _hueBar: Konva.Rect
  _hueMarker: Konva.Rect
  _dragging: 'sv' | 'hue' | null = null

  constructor(config: CustomColorPickerConfig) {
    super()
    this._onPick = config.onPick
    this._width = config.width

    const { h, s, v } = hexToHsv(config.value)
    this._hue = h
    this._sat = s
    this._val = v

    this._svBase = new Konva.Rect({
      width: this._width,
      height: COLOR_FIELD_HEIGHT,
      fill: hsvToHex(h, 1, 1),
    })
    this.add(this._svBase)

    const shade = new Konva.Rect({
      width: this._width,
      height: COLOR_FIELD_HEIGHT,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: this._width, y: 0 },
      fillLinearGradientColorStops: [
        0, 'rgba(255,255,255,1)', 1, 'rgba(255,255,255,0)',
      ],
    })
    this.add(shade)

    const dark = new Konva.Rect({
      width: this._width,
      height: COLOR_FIELD_HEIGHT,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: COLOR_FIELD_HEIGHT },
      fillLinearGradientColorStops: [
        0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,1)',
      ],
    })
    this.add(dark)

    this._svField = new Konva.Rect({
      width: this._width,
      height: COLOR_FIELD_HEIGHT,
      fill: 'transparent',
      cornerRadius: 2,
      stroke: COLORS.BORDER,
      strokeWidth: 1,
    })
    this._svField.on('pointerdown', this._onSVDown)
    this.add(this._svField)

    this._svMarker = new Konva.Circle({
      radius: 4,
      fill: '#ffffff',
      stroke: 'rgba(0,0,0,0.5)',
      strokeWidth: 1,
      listening: false,
    })
    this.add(this._svMarker)

    const hueX = this._width + COLOR_HUE_GAP
    this._hueBar = new Konva.Rect({
      x: hueX,
      width: COLOR_HUE_WIDTH,
      height: COLOR_FIELD_HEIGHT,
      cornerRadius: 2,
      stroke: COLORS.BORDER,
      strokeWidth: 1,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: COLOR_FIELD_HEIGHT },
      fillLinearGradientColorStops: RAINBOW_STOPS,
    })
    this._hueBar.on('pointerdown', this._onHueDown)
    this.add(this._hueBar)

    this._hueMarker = new Konva.Rect({
      x: hueX - 1,
      width: COLOR_HUE_WIDTH + 2,
      height: 3,
      fill: '#ffffff',
      stroke: 'rgba(0,0,0,0.5)',
      strokeWidth: 1,
      listening: false,
    })
    this.add(this._hueMarker)

    this._syncMarkers()
  }

  _onSVDown = (evt: Konva.KonvaEventObject<PointerEvent>) => {
    evt.cancelBubble = true
    this._dragging = 'sv'
    this._pickFromField()
    this._bindDrag()
  }

  _onHueDown = (evt: Konva.KonvaEventObject<PointerEvent>) => {
    evt.cancelBubble = true
    this._dragging = 'hue'
    this._pickFromHue()
    this._bindDrag()
  }

  _bindDrag() {
    const stage = this.getStage()
    if (!stage) return
    stage.on('pointermove.picker', this._onDrag)
    stage.on('pointerup.picker', this._onDragEnd)
  }

  _onDrag = (evt: Konva.KonvaEventObject<PointerEvent>) => {
    // Release may have happened outside the stage (no `pointerup` fired there),
    // so end the drag when no mouse button is held anymore.
    if (evt.evt.buttons === 0) {
      this._onDragEnd()
      return
    }
    if (this._dragging === 'sv') {
      this._pickFromField()
    } else if (this._dragging === 'hue') {
      this._pickFromHue()
    }
  }

  _onDragEnd = () => {
    this._dragging = null
    const stage = this.getStage()
    stage?.off('pointermove.picker pointerup.picker')
  }

  _pickFromField() {
    const pos = this._svField.getRelativePointerPosition()
    if (!pos) return
    this._pickSV(pos.x, pos.y)
  }

  _pickFromHue() {
    const pos = this._hueBar.getRelativePointerPosition()
    if (!pos) return
    this._pickHue(pos.y)
  }

  _pickSV(x: number, y: number) {
    this._sat = clamp01(x / this._width)
    this._val = clamp01(1 - y / COLOR_FIELD_HEIGHT)
    this._syncMarkers()
    this._onPick(hsvToHex(this._hue, this._sat, this._val))
  }

  _pickHue(y: number) {
    this._hue = clamp01(y / COLOR_FIELD_HEIGHT) * 360
    this._syncMarkers()
    this._onPick(hsvToHex(this._hue, this._sat, this._val))
  }

  /**
   * Sync the field to an externally changed value (e.g. a preset swatch was
   * clicked) — re-seeds hue/saturation/value and repositions the markers.
   */
  setValue(color: string) {
    const { h, s, v } = hexToHsv(color)
    this._hue = h
    this._sat = s
    this._val = v
    this._syncMarkers()
  }

  _syncMarkers() {
    this._svBase.fill(hsvToHex(this._hue, 1, 1))
    this._svMarker.position({
      x: this._sat * this._width,
      y: (1 - this._val) * COLOR_FIELD_HEIGHT,
    })
    this._hueMarker.y(
      clamp01(this._hue / 360) * COLOR_FIELD_HEIGHT - this._hueMarker.height() / 2,
    )
    this.getLayer()?.batchDraw()
  }

  destroy(): this {
    this._onDragEnd()
    return super.destroy()
  }
}
