import Konva from 'konva'
import { COLORS } from '../../constants'
import { PADDING } from '../shared'
import type { SelectOption } from './Select'

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

  constructor(config: DropdownConfig) {
    super()
    this._width = config.width
    this._fs = config.fontSize
    this._ff = config.fontFamily
    this._maxVisible = config.maxVisible
    this._onSelect = config.onSelect

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
      fill: COLORS.BG,
      stroke: COLORS.BORDER,
      strokeWidth: 1,
      cornerRadius: 2,
      shadowColor: '#000000',
      shadowBlur: 4,
      shadowOpacity: 0.15,
      shadowOffset: { x: 0, y: 2 },
    })
    this.add(panelBg)

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
        width: this._width - PADDING * 2,
        listening: false,
      })
      itemsGroup.add(text)

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
      e.evt.preventDefault()
      this.scrollBy(e.evt.deltaY > 0 ? 1 : -1)
    })

    this._itemsGroup = itemsGroup

    if (this._focusedIndex >= 0) {
      this.setFocus(this._focusedIndex)
    }
  }

  scrollBy(delta: number) {
    const maxScroll = Math.max(0, this._opts.length - this._maxVisible)
    const next = Math.max(0, Math.min(maxScroll, this._scrollTop + delta))
    if (next === this._scrollTop) return
    this._scrollTop = next
    if (this._itemsGroup) {
      this._itemsGroup.y(-this._scrollTop * ITEM_HEIGHT)
    }
    this.getLayer()?.batchDraw()
  }

  setFocus(index: number) {
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
}
