import Konva from 'konva'
import { registerStageCursor } from '../../cursor'
import { PADDING } from '../shared'
import { Scrollbar, TRACK_INSET, TRACK_WIDTH, wheelFraction } from '../scroll'
import type { SelectOption } from './Select'
import { DEFAULT_THEME } from '../../../theme'
import type { GraphTheme } from '../../../theme'

export const ITEM_HEIGHT = 24

export interface DropdownConfig {
  width: number
  fontSize: number
  fontFamily: string
  maxVisible: number
  onSelect: (index: number) => void
}

export interface DropdownInit {
  options: SelectOption[]
  scrollTop: number
  focusedIndex: number
  above: boolean
  hostHeight: number
}

export class Dropdown extends Konva.Group {
  _opts: SelectOption[] = []
  _scrollTop = 0
  _focusedIndex = -1
  _itemsGroup: Konva.Group | null = null
  _highlight: Konva.Rect | null = null

  _width: number
  _fs: number
  _ff: string
  _maxVisible: number
  _onSelect: (index: number) => void
  _theme: GraphTheme
  _panelBg: Konva.Rect | null = null
  _texts: Konva.Text[] = []
  _scrollbar: Scrollbar | null = null
  _hovered = false

  constructor(config: DropdownConfig, theme: GraphTheme = DEFAULT_THEME) {
    super()
    this._width = config.width
    this._fs = config.fontSize
    this._ff = config.fontFamily
    this._maxVisible = config.maxVisible
    this._onSelect = config.onSelect
    this._theme = theme

    // The popup is lifted out of the node subtree and drawn at the top of the
    // node layer, so it no longer belongs to a node. Swallow pointerdown to
    // stop stage-level gestures (canvas pan / clearing the selection) from
    // firing while interacting with the list.
    this.on('pointerdown', (e) => {
      e.cancelBubble = true
    })
  }

  get scrollTop(): number {
    return this._scrollTop
  }

  get focusedIndex(): number {
    return this._focusedIndex
  }

  open(init: DropdownInit) {
    this._opts = init.options
    this._scrollTop = init.scrollTop
    this._focusedIndex = init.focusedIndex

    const count = this._opts.length
    if (count === 0) return

    const visCount = Math.min(count, this._maxVisible)
    const panelHeight = visCount * ITEM_HEIGHT + 2

    this.y(init.above ? -(panelHeight + 2) : init.hostHeight + 2)

    const panelBg = new Konva.Rect({
      width: this._width,
      height: panelHeight,
      fill: this._theme.colors.bg,
      stroke: this._theme.colors.border,
      strokeWidth: 1,
      cornerRadius: 2,
      shadowColor: '#000000',
      shadowBlur: 4,
      shadowOpacity: 0.15,
      shadowOffset: { x: 0, y: 2 },
    })
    this.add(panelBg)
    this._panelBg = panelBg

    const scrollClip = new Konva.Group({
      clipX: 0,
      clipY: 1,
      clipWidth: this._width,
      clipHeight: visCount * ITEM_HEIGHT,
    })
    this.add(scrollClip)

    const itemsGroup = new Konva.Group({
      y: -this._scrollTop * ITEM_HEIGHT,
    })
    scrollClip.add(itemsGroup)

    const highlight = new Konva.Rect({
      x: 1,
      width: this._width - 2,
      height: ITEM_HEIGHT,
      fill: this._theme.colors.selectionFill,
      visible: false,
      listening: false,
    })
    itemsGroup.add(highlight)
    this._highlight = highlight

    this._texts = []
    this._opts.forEach((opt, i) => {
      const ty = i * ITEM_HEIGHT + (ITEM_HEIGHT - this._fs) / 2
      const text = new Konva.Text({
        text: opt.label,
        fontSize: this._fs,
        fontFamily: this._ff,
        fill: this._theme.colors.textPrimary,
        x: PADDING,
        y: ty,
        width: this._width - PADDING * 2,
        wrap: 'none',
        ellipsis: true,
        listening: false,
      })
      itemsGroup.add(text)
      this._texts.push(text)

      const hit = new Konva.Rect({
        x: 1,
        y: i * ITEM_HEIGHT,
        width: this._width - 2,
        height: ITEM_HEIGHT,
        fill: 'transparent',
      })
      hit.on('mouseenter', () => {
        this.setFocus(i)
      })
      hit.on('mouseleave', () => {
        if (this._focusedIndex === i) {
          this._highlight?.visible(false)
          this.getLayer()?.batchDraw()
        }
      })
      hit.on('click tap', (e) => {
        e.cancelBubble = true
        this._onSelect(i)
      })
      itemsGroup.add(hit)
    })

    this.on('wheel', (e) => {
      // Keep the canvas from zooming: the event bubbles up to the stage-level
      // wheel handler otherwise.
      e.cancelBubble = true
      e.evt.preventDefault()
      this.scrollBy(wheelFraction(e.evt))
    })

    // Register the panel: the cursor center's ancestor walk finds it from any
    // hit item rect.
    registerStageCursor(this, 'pointer')

    this._itemsGroup = itemsGroup

    if (this._maxVisible > 0 && count > this._maxVisible) {
      const trackHeight = visCount * ITEM_HEIGHT - TRACK_INSET * 2
      const scrollbar = new Scrollbar({
        trackHeight,
        theme: this._theme,
        onScroll: (top) => this.scrollTo(top),
        onDragEnd: () => {
          if (!this._hovered) this._scrollbar?.scheduleHide()
        },
      })
      scrollbar.x(this._width - TRACK_WIDTH - TRACK_INSET)
      scrollbar.y(1 + TRACK_INSET)
      this.add(scrollbar)
      this._scrollbar = scrollbar
      this._syncScrollbar()
    }

    this.on('mouseenter', () => {
      this._hovered = true
      this._scrollbar?.show()
    })
    this.on('mouseleave', () => {
      this._hovered = false
      if (!this._scrollbar?.dragging) this._scrollbar?.scheduleHide()
    })

    if (this._focusedIndex >= 0) {
      this.setFocus(this._focusedIndex)
    }
  }

  scrollTo(top: number): void {
    const maxScroll = Math.max(0, this._opts.length - this._maxVisible)
    const next = Math.max(0, Math.min(maxScroll, top))
    if (next === this._scrollTop) return
    this._scrollTop = next
    if (this._itemsGroup) {
      this._itemsGroup.y(-next * ITEM_HEIGHT)
    }
    this._syncScrollbar()
    this._scrollbar?.flash()
    this.getLayer()?.batchDraw()
  }

  _syncScrollbar(): void {
    this._scrollbar?.sync(
      this._scrollTop,
      this._opts.length,
      Math.min(this._opts.length, this._maxVisible),
    )
  }

  scrollBy(delta: number) {
    this.scrollTo(this._scrollTop + delta)
  }

  setFocus(index: number) {
    this._focusedIndex = index
    this._ensureFocusVisible()
    this._scrollbar?.flash()
    if (!this._highlight) return
    if (index >= 0 && index < this._opts.length) {
      this._highlight.y(index * ITEM_HEIGHT)
      this._highlight.visible(true)
    } else {
      this._highlight.visible(false)
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
    this._syncScrollbar()
  }

  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    this._fs = theme.fonts.size
    this._ff = theme.fonts.family
    this._panelBg?.fill(theme.colors.bg)
    this._panelBg?.stroke(theme.colors.border)
    this._highlight?.fill(theme.colors.selectionFill)
    this._scrollbar?.applyTheme(theme)
    for (let i = 0; i < this._texts.length; i++) {
      const text = this._texts[i]
      if (!text) continue
      text.fill(theme.colors.textPrimary)
      text.fontFamily(theme.fonts.family)
      text.fontSize(theme.fonts.size)
      text.y(i * ITEM_HEIGHT + (ITEM_HEIGHT - theme.fonts.size) / 2)
    }
    this.getLayer()?.batchDraw()
  }

  destroy(): this {
    this._scrollbar?.destroy()
    this._scrollbar = null
    return super.destroy()
  }
}
