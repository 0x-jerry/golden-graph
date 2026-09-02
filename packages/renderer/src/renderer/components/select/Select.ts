import Konva from 'konva'
import { FormElement } from '../FormElement'
import { DEFAULT_HEIGHT, PADDING, type BaseFormConfig } from '../shared'
import { Dropdown, ITEM_HEIGHT } from './Dropdown'
import { DEFAULT_THEME } from '../../../theme'
import type { GraphTheme } from '../../../theme'

const ARROW_SIZE = 6
const ARROW_PADDING = 6
const DEFAULT_MAX_VISIBLE = 8

export interface SelectOption {
  value: string
  label: string
}

export interface SelectConfig extends BaseFormConfig {
  selectWidth: number
  selectHeight?: number
  options: (SelectOption | string)[]
  value?: string
  placeholder?: string
  maxVisibleItems?: number
  onChange?: (value: string) => void
}

function normalizeOptions(opts: (SelectOption | string)[]): SelectOption[] {
  return opts.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
}

export class Select extends FormElement {
  _bg: Konva.Rect
  _textNode: Konva.Text
  _placeholderNode: Konva.Text
  _arrow: Konva.Line

  _opts: SelectOption[]
  _val: string
  _maxVisible: number
  _onChange?: (value: string) => void

  _dropdown: Dropdown | null = null

  _sw: number
  _sh: number

  constructor(config: SelectConfig, theme?: GraphTheme) {
    const t = theme ?? DEFAULT_THEME
    const {
      selectWidth,
      selectHeight = DEFAULT_HEIGHT,
      options,
      value = '',
      placeholder = '',
      strokeWidth = 1,
      cornerRadius = 2,
      maxVisibleItems = DEFAULT_MAX_VISIBLE,
      onChange,
      ...rest
    } = config

    super(rest, t)

    this._sw = selectWidth
    this._sh = selectHeight
    this._maxVisible = maxVisibleItems
    this._onChange = onChange
    this._opts = normalizeOptions(options)
    this._val = value

    const textY = (selectHeight - this._fs) / 2
    const textW = selectWidth - ARROW_SIZE - ARROW_PADDING * 2 - PADDING
    const matched = this._opts.find((o) => o.value === value)

    this._bg = new Konva.Rect({
      width: selectWidth,
      height: selectHeight,
      fill: this._fill,
      stroke: this._borderColor,
      strokeWidth,
      cornerRadius,
    })
    this.add(this._bg)

    this._textNode = new Konva.Text({
      text: matched?.label ?? '',
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: t.colors.textPrimary,
      x: PADDING,
      y: textY,
      width: textW,
      listening: false,
    })
    this.add(this._textNode)

    this._placeholderNode = new Konva.Text({
      text: placeholder,
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: t.colors.textMuted,
      x: PADDING,
      y: textY,
      width: textW,
      visible: !matched,
      listening: false,
    })
    this.add(this._placeholderNode)

    const ax = selectWidth - ARROW_SIZE - ARROW_PADDING
    const ay = selectHeight / 2 - 2
    this._arrow = new Konva.Line({
      points: [ax, ay, ax + ARROW_SIZE / 2, ay + 4, ax + ARROW_SIZE, ay],
      stroke: t.colors.textMuted,
      strokeWidth: 1.5,
      lineCap: 'round',
      lineJoin: 'round',
      listening: false,
    })
    this.add(this._arrow)

    const toggle = (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true
      if (this._active) {
        // Fully end the edit session: `deactivate()` runs `_deactivate()` →
        // `_close()`, then unbinds the window keydown listener and resets
        // `_active`. Without that, the next click would see `_active === true`
        // and call `_close()` again instead of reopening the dropdown.
        this.deactivate()
      } else {
        this._openDropdown()
      }
    }
    this._bg.on('click tap', toggle)
    this._textNode.on('click tap', toggle)
    this._placeholderNode.on('click tap', toggle)
  }

  getValue(): string {
    return this._val
  }

  /**
   * Resize the select box (e.g. when its node is resized). Reflows the
   * background, text and arrow to the new width.
   */
  setWidth(width: number) {
    if (width === this._sw) return
    this._sw = width
    this._bg.width(width)
    const textW = width - ARROW_SIZE - ARROW_PADDING * 2 - PADDING
    this._textNode.width(textW)
    this._placeholderNode.width(textW)
    const ax = width - ARROW_SIZE - ARROW_PADDING
    const ay = this._sh / 2 - 2
    this._arrow.points([
      ax,
      ay,
      ax + ARROW_SIZE / 2,
      ay + 4,
      ax + ARROW_SIZE,
      ay,
    ])
    this.getLayer()?.batchDraw()
  }

  setValue(value: string) {
    this._val = value
    const opt = this._opts.find((o) => o.value === value)
    this._textNode.text(opt?.label ?? '')
    this._placeholderNode.visible(!opt)
    this.getLayer()?.batchDraw()
    this._onChange?.(value)
  }

  setOptions(options: (SelectOption | string)[]) {
    this._opts = normalizeOptions(options)
    const matched = this._opts.find((o) => o.value === this._val)
    this._textNode.text(matched?.label ?? '')
    this._placeholderNode.visible(!matched)
    if (this._active && this._dropdown) {
      this._mountDropdown(this._dropdown.scrollTop, this._dropdown.focusedIndex)
    }
    this.getLayer()?.batchDraw()
  }

  _openDropdown() {
    if (this._active) return
    this._activate()
    this._bg.stroke(this._theme.colors.accent)

    const focusedIndex = this._opts.findIndex((o) => o.value === this._val)
    let scrollTop = 0
    if (focusedIndex >= 0) {
      const vis = Math.min(this._opts.length, this._maxVisible)
      if (focusedIndex >= vis) {
        scrollTop = Math.min(
          focusedIndex - vis + 1,
          Math.max(0, this._opts.length - vis),
        )
      }
    }

    this._mountDropdown(scrollTop, focusedIndex)
    this.getLayer()?.batchDraw()
  }

  _mountDropdown(scrollTop: number, focusedIndex: number) {
    this._unmountDropdown()

    const dropdown = new Dropdown(
      {
        width: this._sw,
        fontSize: this._fs,
        fontFamily: this._ff,
        maxVisible: this._maxVisible,
        onSelect: (index) => this._selectIndex(index),
      },
      this._theme,
    )
    dropdown.open({
      options: this._opts,
      scrollTop,
      focusedIndex,
      above: this._shouldOpenAbove(),
      hostHeight: this._sh,
    })
    this._dropdown = dropdown

    // Render the popup at the top of the node layer instead of inside the
    // node's subtree, so it is never covered by other (higher z-order) nodes.
    // Add to the Select first so the absolute position comes from the real
    // scene transform, then reparent to the layer keeping that position.
    const layer = this.getLayer()
    if (layer) {
      this.add(dropdown)
      const absPos = dropdown.getAbsolutePosition()
      layer.add(dropdown)
      dropdown.setAbsolutePosition(absPos)
    } else {
      this.add(dropdown)
    }
  }

  _unmountDropdown() {
    if (this._dropdown) {
      this._dropdown.destroy()
      this._dropdown = null
    }
  }

  _shouldOpenAbove(): boolean {
    const stage = this.getStage()
    if (!stage) return false

    const visCount = Math.min(this._opts.length, this._maxVisible)
    const panelHeight = visCount * ITEM_HEIGHT + 2

    const scale = stage.scaleY()
    const absY = this.getAbsolutePosition().y
    const spaceBelow = stage.height() - (absY + this._sh * scale)
    const spaceAbove = absY
    return panelHeight * scale > spaceBelow && spaceAbove > spaceBelow
  }

  _selectIndex(index: number) {
    const opt = this._opts[index]
    if (!opt) return
    this.setValue(opt.value)
    // `deactivate()` (not just `_close()`) so the Select returns to the
    // inactive state — otherwise a subsequent click on the box would toggle
    // it closed instead of reopening the dropdown.
    this.deactivate()
  }

  _close() {
    if (!this._active) return

    this._bg.stroke(this._borderColor)
    this._unmountDropdown()

    this.getLayer()?.batchDraw()
  }

  protected _onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      this._close()
      return
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const idx = this._dropdown?.focusedIndex ?? -1
      if (idx >= 0) {
        this._selectIndex(idx)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!this._active) {
        this._openDropdown()
        return
      }
      const dropdown = this._dropdown
      if (dropdown) {
        const cur = dropdown.focusedIndex
        dropdown.setFocus(cur < this._opts.length - 1 ? cur + 1 : 0)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!this._active) {
        this._openDropdown()
        return
      }
      const dropdown = this._dropdown
      if (dropdown) {
        const cur = dropdown.focusedIndex
        dropdown.setFocus(cur > 0 ? cur - 1 : this._opts.length - 1)
      }
      return
    }

    if (e.key === 'PageDown') {
      e.preventDefault()
      const dropdown = this._dropdown
      if (this._active && dropdown) {
        dropdown.setFocus(
          Math.min(
            dropdown.focusedIndex + this._maxVisible,
            this._opts.length - 1,
          ),
        )
      }
      return
    }

    if (e.key === 'PageUp') {
      e.preventDefault()
      const dropdown = this._dropdown
      if (this._active && dropdown) {
        dropdown.setFocus(Math.max(dropdown.focusedIndex - this._maxVisible, 0))
      }
      return
    }
  }

  protected _deactivate(): void {
    this._close()
  }

  applyTheme(theme: GraphTheme): void {
    super.applyTheme(theme)

    this._bg.fill(this._fillExplicit ? this._fill : theme.colors.bg)
    this._bg.stroke(this._active ? theme.colors.accent : this._borderColor)
    this._textNode.fill(theme.colors.textPrimary)
    this._textNode.fontFamily(theme.fonts.family)
    this._placeholderNode.fill(theme.colors.textMuted)
    this._placeholderNode.fontFamily(theme.fonts.family)
    this._arrow.stroke(theme.colors.textMuted)
    this._dropdown?.applyTheme?.(theme)

    // Re-center the label/placeholder for the new font size.
    const textY = (this._sh - this._fs) / 2
    this._textNode.y(textY)
    this._textNode.fontSize(this._fs)
    this._placeholderNode.y(textY)
    this._placeholderNode.fontSize(this._fs)
  }
}
