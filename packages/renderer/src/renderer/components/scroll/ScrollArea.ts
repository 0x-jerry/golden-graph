import Konva from 'konva'
import { Scrollbar, TRACK_INSET, TRACK_WIDTH } from './Scrollbar'
import { DEFAULT_THEME } from '../../../theme'
import type { GraphTheme } from '../../../theme'

const DEFAULT_WHEEL_STEP = 18
/** `deltaY` a typical mouse-wheel notch reports in pixel delta mode. */
const WHEEL_NOTCH_PIXELS = 100

/**
 * Normalize a wheel event to a fraction of one scroll step, clamped to
 * [-1, 1]. Trackpads emit many small deltas, so scaling by the reported
 * delta keeps scrolling proportional to the gesture instead of one full step
 * per event (which made trackpad scrolling race); a mouse notch (~100px)
 * still maps to exactly one step.
 */
export function wheelFraction(e: WheelEvent): number {
  const pixels =
    e.deltaMode === 1
      ? e.deltaY * WHEEL_NOTCH_PIXELS
      : e.deltaMode === 2
        ? Math.sign(e.deltaY) * WHEEL_NOTCH_PIXELS
        : e.deltaY
  return Math.max(-1, Math.min(1, pixels / WHEEL_NOTCH_PIXELS))
}

export interface ScrollAreaConfig {
  width: number
  height: number
  theme?: GraphTheme
  /** Forwarded to the scrollbar: `false` shows/hides it without fading. */
  animations?: boolean
  /** Pixels scrolled per wheel notch. */
  wheelStep?: number
}

/**
 * Clipped, vertically scrollable viewport. Hosts a content group (moved by
 * `-scrollTop`) and an auto-hiding {@link Scrollbar} overlay. Wheel scrolling
 * only claims the event while the content actually overflows, so a short
 * scroll area still lets the wheel reach the canvas zoom handler.
 */
export class ScrollArea extends Konva.Group {
  readonly content: Konva.Group

  _hit: Konva.Rect
  _scrollbar: Scrollbar
  _w: number
  _h: number
  _contentHeight = 0
  _scrollTop = 0
  _wheelStep: number
  _hovered = false

  constructor(config: ScrollAreaConfig) {
    const theme = config.theme ?? DEFAULT_THEME
    super()
    this._w = config.width
    this._h = config.height
    this._wheelStep = config.wheelStep ?? DEFAULT_WHEEL_STEP

    this.clipX(0)
    this.clipY(0)
    this.clipWidth(config.width)
    this.clipHeight(config.height)

    // Full-viewport hit shape so hover/auto-hide works across the whole area,
    // not only where content happens to have a listening node.
    this._hit = new Konva.Rect({
      width: config.width,
      height: config.height,
      fill: 'transparent',
    })
    this.add(this._hit)

    this.content = new Konva.Group()
    this.add(this.content)

    this._scrollbar = new Scrollbar({
      trackHeight: config.height - TRACK_INSET * 2,
      theme,
      animations: config.animations,
      onScroll: (top) => this.scrollTo(top),
      onDragEnd: () => {
        if (!this._hovered) this._scrollbar.scheduleHide()
      },
    })
    this._scrollbar.x(config.width - TRACK_WIDTH - TRACK_INSET)
    this._scrollbar.y(TRACK_INSET)
    this.add(this._scrollbar)

    this.on('mouseenter', () => {
      this._hovered = true
      this._scrollbar.show()
    })
    this.on('mouseleave', () => {
      this._hovered = false
      this._scrollbar.scheduleHide()
    })
    this.on('wheel', (e) => {
      if (this._contentHeight <= this._h) return
      e.cancelBubble = true
      e.evt.preventDefault()
      this.scrollBy(wheelFraction(e.evt) * this._wheelStep)
      this.flash()
    })
  }

  get scrollTop(): number {
    return this._scrollTop
  }

  get scrollbar(): Scrollbar {
    return this._scrollbar
  }

  resize(width: number, height: number): void {
    this._w = width
    this._h = height
    this.clipWidth(width)
    this.clipHeight(height)
    this._hit.width(width)
    this._hit.height(height)
    this._scrollbar.x(width - TRACK_WIDTH - TRACK_INSET)
    this._scrollbar.y(TRACK_INSET)
    this._scrollbar.setTrackHeight(height - TRACK_INSET * 2)
    this.scrollTo(this._scrollTop)
  }

  setContentHeight(height: number): void {
    this._contentHeight = height
    this.scrollTo(this._scrollTop)
  }

  scrollTo(top: number): void {
    const max = Math.max(0, this._contentHeight - this._h)
    const next = Math.max(0, Math.min(max, top))
    this._scrollTop = next
    this.content.y(-next)
    this._scrollbar.sync(next, this._contentHeight, this._h)
    this.getLayer()?.batchDraw()
  }

  scrollBy(delta: number): void {
    this.scrollTo(this._scrollTop + delta)
  }

  flash(): void {
    this._scrollbar.flash()
  }

  applyTheme(theme: GraphTheme): void {
    this._scrollbar.applyTheme(theme)
  }

  destroy(): this {
    this._scrollbar.destroy()
    return super.destroy()
  }
}
