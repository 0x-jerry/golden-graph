import Konva from 'konva'
import { COLORS } from '../constants'
import { FormElement } from './FormElement'
import {
  DEFAULT_HEIGHT,
  PADDING,
  type BaseFormConfig,
} from './shared'

const ARROW_SIZE = 6
const ARROW_PADDING = 6
const ITEM_HEIGHT = 24
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
  declare _bg: Konva.Rect
  declare _textNode: Konva.Text
  declare _placeholderNode: Konva.Text
  declare _arrow: Konva.Line

  declare _opts: SelectOption[]
  declare _val: string
  declare _focusedIndex: number
  declare _scrollTop: number
  declare _maxVisible: number
  declare _onChange?: (value: string) => void

  declare _dropdown: Konva.Group | null
  declare _itemsGroup: Konva.Group | null
  declare _highlight: Konva.Rect | null

  declare _sw: number
  declare _sh: number

  constructor(config: SelectConfig) {
    const {
      selectWidth,
      selectHeight = DEFAULT_HEIGHT,
      options,
      value = '',
      placeholder = '',
      fill = COLORS.BG,
      strokeWidth = 1,
      cornerRadius = 2,
      maxVisibleItems = DEFAULT_MAX_VISIBLE,
      onChange,
      ...rest
    } = config

    super(rest)

    this._sw = selectWidth
    this._sh = selectHeight
    this._maxVisible = maxVisibleItems
    this._onChange = onChange
    this._opts = normalizeOptions(options)
    this._val = value
    this._focusedIndex = -1
    this._scrollTop = 0
    this._dropdown = null
    this._itemsGroup = null
    this._highlight = null

    const textY = (selectHeight - this._fs) / 2
    const textW = selectWidth - ARROW_SIZE - ARROW_PADDING * 2 - PADDING
    const matched = this._opts.find((o) => o.value === value)

    this._bg = new Konva.Rect({
      width: selectWidth,
      height: selectHeight,
      fill,
      stroke: this._borderColor,
      strokeWidth,
      cornerRadius,
    })
    this.add(this._bg)

    this._textNode = new Konva.Text({
      text: matched?.label ?? '',
      fontSize: this._fs,
      fontFamily: this._ff,
      fill: COLORS.TEXT_PRIMARY,
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
      fill: COLORS.TEXT_MUTED,
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
      stroke: COLORS.TEXT_MUTED,
      strokeWidth: 1.5,
      lineCap: 'round',
      lineJoin: 'round',
      listening: false,
    })
    this.add(this._arrow)

    const toggle = (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true
      if (this._active) {
        this._close()
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
    if (this._active) {
      this._buildDropdown()
    }
    this.getLayer()?.batchDraw()
  }

  _openDropdown() {
    if (this._active) return
    this._activate()
    this._bg.stroke(COLORS.ACCENT)

    this._focusedIndex = this._opts.findIndex((o) => o.value === this._val)

    if (this._focusedIndex >= 0) {
      const vis = Math.min(this._opts.length, this._maxVisible)
      if (this._focusedIndex >= vis) {
        this._scrollTop = Math.min(
          this._focusedIndex - vis + 1,
          Math.max(0, this._opts.length - vis),
        )
      } else {
        this._scrollTop = 0
      }
    } else {
      this._scrollTop = 0
    }

    this._buildDropdown()
    this.getLayer()?.batchDraw()
  }

  _buildDropdown() {
    this._destroyDropdown()

    const count = this._opts.length
    if (count === 0) return

    const visCount = Math.min(count, this._maxVisible)
    const panelHeight = visCount * ITEM_HEIGHT + 2

    const stage = this.getStage()
    let openAbove = false
    if (stage) {
      const scale = stage.scaleY()
      const absY = this.getAbsolutePosition().y
      const spaceBelow = stage.height() - (absY + this._sh * scale)
      const spaceAbove = absY
      const panelPx = panelHeight * scale
      openAbove = panelPx > spaceBelow && spaceAbove > spaceBelow
    }

    const dropdown = new Konva.Group({
      y: openAbove ? -(panelHeight + 2) : this._sh + 2,
    })

    const panelBg = new Konva.Rect({
      width: this._sw,
      height: panelHeight,
      fill: COLORS.BG,
      stroke: COLORS.BORDER,
      strokeWidth: 1,
      cornerRadius: 2,
      shadowColor: '#000000',
      shadowBlur: 4,
      shadowOpacity: 0.15,
      shadowOffset: { x: 0, y: 2 },
    })
    dropdown.add(panelBg)

    const scrollClip = new Konva.Group({
      clipX: 0,
      clipY: 1,
      clipWidth: this._sw,
      clipHeight: visCount * ITEM_HEIGHT,
    })
    dropdown.add(scrollClip)

    const itemsGroup = new Konva.Group({
      y: -this._scrollTop * ITEM_HEIGHT,
    })
    scrollClip.add(itemsGroup)

    const highlight = new Konva.Rect({
      x: 1,
      width: this._sw - 2,
      height: ITEM_HEIGHT,
      fill: COLORS.SELECTION_FILL,
      visible: false,
      listening: false,
    })
    itemsGroup.add(highlight)
    this._highlight = highlight

    this._opts.forEach((opt, i) => {
      const ty = i * ITEM_HEIGHT + (ITEM_HEIGHT - this._fs) / 2
      const text = new Konva.Text({
        text: opt.label,
        fontSize: this._fs,
        fontFamily: this._ff,
        fill: COLORS.TEXT_PRIMARY,
        x: PADDING,
        y: ty,
        width: this._sw - PADDING * 2,
        listening: false,
      })
      itemsGroup.add(text)

      const hit = new Konva.Rect({
        x: 1,
        y: i * ITEM_HEIGHT,
        width: this._sw - 2,
        height: ITEM_HEIGHT,
        fill: 'transparent',
      })
      hit.on('mouseenter', () => {
        this._setFocus(i)
      })
      hit.on('mouseleave', () => {
        if (this._focusedIndex === i) {
          this._highlight?.visible(false)
          this.getLayer()?.batchDraw()
        }
      })
      hit.on('click tap', (e) => {
        e.cancelBubble = true
        this._selectIndex(i)
      })
      itemsGroup.add(hit)
    })

    dropdown.on('wheel', (e) => {
      e.evt.preventDefault()
      this._scrollBy(e.evt.deltaY > 0 ? 1 : -1)
    })

    this._dropdown = dropdown
    this._itemsGroup = itemsGroup
    this.add(dropdown)

    if (this._focusedIndex >= 0) {
      this._setFocus(this._focusedIndex)
    }
  }

  _destroyDropdown() {
    if (this._dropdown) {
      this._dropdown.destroy()
      this._dropdown = null
      this._itemsGroup = null
      this._highlight = null
    }
  }

  _scrollBy(delta: number) {
    const maxScroll = Math.max(0, this._opts.length - this._maxVisible)
    const next = Math.max(0, Math.min(maxScroll, this._scrollTop + delta))
    if (next === this._scrollTop) return
    this._scrollTop = next
    if (this._itemsGroup) {
      this._itemsGroup.y(-this._scrollTop * ITEM_HEIGHT)
    }
    this.getLayer()?.batchDraw()
  }

  _ensureFocusVisible() {
    if (this._focusedIndex < this._scrollTop) {
      this._scrollTop = this._focusedIndex
    } else if (this._focusedIndex >= this._scrollTop + this._maxVisible) {
      this._scrollTop = this._focusedIndex - this._maxVisible + 1
    }
    if (this._itemsGroup) {
      this._itemsGroup.y(-this._scrollTop * ITEM_HEIGHT)
    }
  }

  _setFocus(index: number) {
    this._focusedIndex = index
    this._ensureFocusVisible()
    if (!this._highlight) return
    if (index >= 0 && index < this._opts.length) {
      this._highlight.y(index * ITEM_HEIGHT)
      this._highlight.visible(true)
    } else {
      this._highlight.visible(false)
    }
    this.getLayer()?.batchDraw()
  }

  _selectIndex(index: number) {
    const opt = this._opts[index]
    if (!opt) return
    this.setValue(opt.value)
    this._close()
  }

  _close() {
    if (!this._active) return

    this._bg.stroke(this._borderColor)
    this._destroyDropdown()

    this.getLayer()?.batchDraw()
    this._deactivate()
  }

  protected _onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      this._close()
      return
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (this._focusedIndex >= 0) {
        this._selectIndex(this._focusedIndex)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!this._active) {
        this._openDropdown()
        return
      }
      const next = this._focusedIndex < this._opts.length - 1 ? this._focusedIndex + 1 : 0
      this._setFocus(next)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!this._active) {
        this._openDropdown()
        return
      }
      const prev = this._focusedIndex > 0 ? this._focusedIndex - 1 : this._opts.length - 1
      this._setFocus(prev)
      return
    }

    if (e.key === 'PageDown') {
      e.preventDefault()
      if (this._active) {
        const next = Math.min(this._focusedIndex + this._maxVisible, this._opts.length - 1)
        this._setFocus(next)
      }
      return
    }

    if (e.key === 'PageUp') {
      e.preventDefault()
      if (this._active) {
        const prev = Math.max(this._focusedIndex - this._maxVisible, 0)
        this._setFocus(prev)
      }
      return
    }
  }

  protected _onStageClick(): void {
    this._close()
  }

  protected _onOutsideClick(): void {
    this._close()
  }
}
