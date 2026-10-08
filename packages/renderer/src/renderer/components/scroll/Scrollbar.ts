import Konva from 'konva'
import { registerStageCursor } from '../../cursor'
import { DEFAULT_THEME } from '../../../theme'
import type { GraphTheme } from '../../../theme'
import {
  animationDuration,
  animateProgress,
  inQuad,
  outQuad,
  SCROLLBAR_FADE_MS,
} from '../../animations'
import type { Animator } from '../../animations'

export const TRACK_WIDTH = 4
export const THUMB_WIDTH = 4
export const TRACK_INSET = 0

const MIN_THUMB_HEIGHT = 20
const HIDE_DELAY_MS = 600

export interface ScrollbarConfig {
  trackHeight: number
  theme?: GraphTheme
  /** `false` shows/hides instantly instead of fading. */
  animations?: boolean
  onScroll: (scrollTop: number) => void
  onDragEnd?: () => void
}

/**
 * Vertical scrollbar overlay. Unit-agnostic: the host passes content/viewport
 * sizes in whatever unit it scrolls in (items, pixels) and receives the same
 * unit back from `onScroll`. Auto-hides on a timer once the host stops
 * hovering; the host drives `show`/`scheduleHide`/`flash`.
 *
 * Showing and hiding fade the overlay in/out unless animations are disabled
 * (or the OS asks for reduced motion), in which case both snap.
 */
export class Scrollbar extends Konva.Group {
  _track: Konva.Rect
  _thumb: Konva.Rect

  _trackHeight: number
  _scrollTop = 0
  _contentSize = 0
  _viewportSize = 0
  _overflow = false
  _theme: GraphTheme
  _animations: boolean
  _onScroll: (scrollTop: number) => void
  _onDragEnd?: () => void

  _hideTimer: ReturnType<typeof setTimeout> | null = null
  _dragging = false
  _grabOffset = 0
  /** In-flight fade; `null` when the overlay is at rest. */
  _fadeAnim: Animator | null = null
  /** Opacity the in-flight fade is heading to; `null` when at rest. */
  _fadeTarget: number | null = null

  constructor(config: ScrollbarConfig) {
    const theme = config.theme ?? DEFAULT_THEME
    super()
    this._trackHeight = config.trackHeight
    this._theme = theme
    this._animations = config.animations ?? true
    this._onScroll = config.onScroll
    this._onDragEnd = config.onDragEnd

    this._track = new Konva.Rect({
      width: TRACK_WIDTH,
      height: config.trackHeight,
      cornerRadius: TRACK_WIDTH / 2,
      fill: theme.colors.bgHover,
    })
    this.add(this._track)

    this._thumb = new Konva.Rect({
      x: (TRACK_WIDTH - THUMB_WIDTH) / 2,
      width: THUMB_WIDTH,
      height: 0,
      cornerRadius: THUMB_WIDTH / 2,
      fill: theme.colors.textMuted,
      opacity: 0.6,
    })
    this.add(this._thumb)

    this._track.on('mousedown touchstart', (e) => {
      e.cancelBubble = true
      this._pageTo(this._pointerY())
    })
    this._track.on('click tap', (e) => {
      e.cancelBubble = true
    })
    this._thumb.on('mousedown touchstart', (e) => {
      e.cancelBubble = true
      this._startDrag()
    })
    this._thumb.on('click tap', (e) => {
      e.cancelBubble = true
    })

    this.visible(false)
    this.opacity(0)
    this.listening(false)
    registerStageCursor(this, 'pointer')
  }

  get dragging(): boolean {
    return this._dragging
  }

  setTrackHeight(height: number): void {
    this._trackHeight = height
    this._track.height(height)
  }

  sync(scrollTop: number, contentSize: number, viewportSize: number): void {
    this._scrollTop = scrollTop
    this._contentSize = contentSize
    this._viewportSize = viewportSize

    const overflow = contentSize > viewportSize && viewportSize > 0
    this._overflow = overflow
    if (!overflow) {
      this._hideNow()
      return
    }

    this._thumb.height(this._thumbHeight())
    this._thumb.y(this._thumbYFor(scrollTop))
    this.getLayer()?.batchDraw()
  }

  show(): this {
    if (!this._overflow) return this
    this._clearTimer()
    this.visible(true)
    this.listening(true)
    this.getLayer()?.batchDraw()
    this._fadeTo(1)
    return this
  }

  hide(): this {
    this._clearTimer()
    if (!this.visible()) return this
    // Stop answering pointer events while fading away, so a click on the
    // half-transparent track cannot page the content.
    this.listening(false)
    this._fadeTo(0)
    return this
  }

  /** Show now, then hide after the delay unless the host keeps it alive. */
  flash(): void {
    this.show()
    this.scheduleHide()
  }

  scheduleHide(): void {
    if (this._dragging) return
    this._clearTimer()
    this._hideTimer = setTimeout(() => {
      this._hideTimer = null
      this.hide()
    }, HIDE_DELAY_MS)
  }

  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    this._track.fill(theme.colors.bgHover)
    this._thumb.fill(theme.colors.textMuted)
    this.getLayer()?.batchDraw()
  }

  _thumbHeight(): number {
    const ratio = this._viewportSize / this._contentSize
    return Math.max(
      MIN_THUMB_HEIGHT,
      Math.min(this._trackHeight, this._trackHeight * ratio),
    )
  }

  _maxScroll(): number {
    return Math.max(0, this._contentSize - this._viewportSize)
  }

  _maxThumbY(): number {
    return this._trackHeight - this._thumbHeight()
  }

  _thumbYFor(scrollTop: number): number {
    const maxThumbY = this._maxThumbY()
    const maxScroll = this._maxScroll()
    if (maxThumbY <= 0 || maxScroll <= 0) return 0
    return (scrollTop / maxScroll) * maxThumbY
  }

  _scrollFromThumbY(y: number): number {
    const maxThumbY = this._maxThumbY()
    const maxScroll = this._maxScroll()
    if (maxThumbY <= 0 || maxScroll <= 0) return 0
    const clamped = Math.max(0, Math.min(maxThumbY, y))
    return Math.round((clamped / maxThumbY) * maxScroll)
  }

  _pageFromPointerY(y: number): number {
    const thumbY = this._thumbYFor(this._scrollTop)
    const dir = y < thumbY ? -1 : 1
    return this._scrollTop + dir * this._viewportSize
  }

  _pageTo(y: number): void {
    this.show()
    this._onScroll(this._pageFromPointerY(y))
  }

  _pointerY(): number {
    return this._track.getRelativePointerPosition()?.y ?? 0
  }

  _startDrag(): void {
    this._dragging = true
    this._grabOffset = this._pointerY() - this._thumbYFor(this._scrollTop)
    this.show()
    const stage = this.getStage()
    if (stage) {
      stage.on('mousemove touchmove', this._onMove)
      stage.on('mouseup touchend', this._onUp)
    }
    // A release outside the canvas never reaches the stage, which would leave
    // the drag stuck on; listen on the window so it always ends.
    window.addEventListener('mouseup', this._onUp)
    window.addEventListener('touchend', this._onUp)
  }

  _onMove = (): void => {
    if (!this._dragging) return
    const y = this._pointerY() - this._grabOffset
    this._onScroll(this._scrollFromThumbY(y))
  }

  _onUp = (): void => {
    if (!this._dragging) return
    this._dragging = false
    this._detachStage()
    this._onDragEnd?.()
  }

  _detachStage(): void {
    const stage = this.getStage()
    if (stage) {
      stage.off('mousemove touchmove', this._onMove)
      stage.off('mouseup touchend', this._onUp)
    }
    window.removeEventListener('mouseup', this._onUp)
    window.removeEventListener('touchend', this._onUp)
  }

  _clearTimer(): void {
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer)
      this._hideTimer = null
    }
  }

  /**
   * Fade to `target` opacity. Re-asking for the opacity already in flight is a
   * no-op, so wheel/flash bursts do not restart the fade. A cancelled fade
   * keeps the current opacity, so an interrupted show/hide continues smoothly
   * from where it was.
   */
  _fadeTo(target: number): void {
    if (this._fadeTarget === target) return
    this._fadeAnim?.cancel()
    this._fadeAnim = null

    const from = this.opacity()
    if (from === target) {
      this._fadeTarget = null
      this._settleFade(target)
      return
    }

    this._fadeTarget = target
    const duration = animationDuration(SCROLLBAR_FADE_MS, this._animations)
    this._fadeAnim = animateProgress({
      from,
      to: target,
      duration,
      ease: target === 1 ? outQuad : inQuad,
      onFrame: (value) => this._applyFade(value),
      onDone: () => {
        this._fadeAnim = null
        this._fadeTarget = null
        this._settleFade(target)
      },
    })
  }

  /** Reach the fade's end state: only a hidden overlay stops listening. */
  _settleFade(target: number): void {
    if (target === 0) {
      this.visible(false)
      this.listening(false)
    }
    this._applyFade(target)
  }

  _applyFade(value: number): void {
    this.opacity(value)
    this.getLayer()?.batchDraw()
  }

  /** Snap straight to hidden: content no longer overflows. */
  _hideNow(): void {
    this._fadeAnim?.cancel()
    this._fadeAnim = null
    this._fadeTarget = null
    this.visible(false)
    this.listening(false)
    this._applyFade(0)
  }

  destroy(): this {
    this._clearTimer()
    this._fadeAnim?.cancel()
    this._fadeAnim = null
    this._fadeTarget = null
    this._detachStage()
    this._dragging = false
    return super.destroy()
  }
}
