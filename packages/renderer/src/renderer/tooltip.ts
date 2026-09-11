import type Konva from 'konva'

/** Default show/hide delay (ms) for a tooltip. */
export const TOOLTIP_DELAY = 200

const TOOLTIP_OFFSET = 8
const TOOLTIP_MAX_WIDTH = 240

let _el: HTMLDivElement | null = null

function ensureElement(): HTMLDivElement {
  if (_el) return _el

  const el = document.createElement('div')
  el.className = 'r-graph-tooltip'
  el.style.cssText = [
    'position:fixed',
    'z-index:9999',
    'pointer-events:none',
    'display:none',
    'max-width:' + TOOLTIP_MAX_WIDTH + 'px',
    'padding:6px 8px',
    'background:rgba(20, 22, 26, 0.92)',
    'color:#f5f5f7',
    'font-size:12px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    'line-height:1.4',
    'border-radius:4px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.2)',
    'white-space:pre-wrap',
    'word-break:break-word',
  ].join(';')
  document.body.appendChild(el)
  _el = el
  return el
}

/**
 * Which side of `anchor` the tooltip grows from.
 * - `'start'`: left edge at the anchor (left-positioned handles).
 * - `'end'`: right edge at the anchor (right-positioned handles), so the
 *   tooltip stays over the handle instead of hanging off the node's edge.
 */
export type TooltipAlign = 'start' | 'end'

/**
 * Show the shared tooltip near `anchor`. The element is appended to
 * `document.body` and positioned in viewport pixels, so it stays readable
 * regardless of the stage zoom.
 */
export function showTooltip(
  anchor: Konva.Node,
  text: string,
  align: TooltipAlign = 'start',
) {
  const stage = anchor.getStage()
  if (!stage) return

  const el = ensureElement()
  el.textContent = text
  el.style.display = 'block'

  const container = stage.container()
  const absPos = anchor.getAbsolutePosition()
  const rect = container.getBoundingClientRect()

  const x = rect.left + absPos.x
  const y = rect.top + absPos.y

  // Measure now that the element is displayed.
  const w = el.offsetWidth
  const h = el.offsetHeight

  let left = align === 'end' ? x - w : x
  let top = y - h - TOOLTIP_OFFSET

  // Flip below when the space above is insufficient.
  if (top < rect.top) {
    top = y + TOOLTIP_OFFSET
  }

  // Keep the tooltip inside the stage container.
  left = Math.max(rect.left, Math.min(left, rect.right - w - TOOLTIP_OFFSET))
  top = Math.min(top, rect.bottom - h - TOOLTIP_OFFSET)

  el.style.left = `${left}px`
  el.style.top = `${top}px`
}

export function hideTooltip() {
  if (!_el) return
  _el.style.display = 'none'
}

/** Remove the tooltip element (e.g. when the renderer is disposed). */
export function disposeTooltip() {
  if (_el) {
    _el.remove()
    _el = null
  }
}

export interface TooltipOptions {
  /** Text shown while hovering. */
  text: string
  /** Node the tooltip points at; defaults to the hovered node. */
  anchor?: () => Konva.Node
  /** Which side of the anchor the tooltip grows from. */
  align?: TooltipAlign
  /** Wait (ms) after pointer-over before showing. Defaults to `TOOLTIP_DELAY`. */
  showDelay?: number
  /** Grace period (ms) after pointer-leave before hiding. Defaults to `TOOLTIP_DELAY`. */
  hideDelay?: number
}

/**
 * Hover tooltip for a Konva node: shows `text` anchored at `anchor()` — the
 * hovered node itself by default — after `showDelay`, and hides `hideDelay`
 * after the pointer leaves.
 */
export class Tooltip {
  _target: Konva.Node
  _text: string
  _anchor: () => Konva.Node
  _align: TooltipAlign
  _showDelay: number
  _hideDelay: number
  _showTimer: ReturnType<typeof setTimeout> | null = null
  _hideTimer: ReturnType<typeof setTimeout> | null = null
  _visible = false

  constructor(target: Konva.Node, options: TooltipOptions) {
    this._target = target
    this._text = options.text
    this._anchor = options.anchor ?? (() => target)
    this._align = options.align ?? 'start'
    this._showDelay = options.showDelay ?? TOOLTIP_DELAY
    this._hideDelay = options.hideDelay ?? TOOLTIP_DELAY

    target.on('mouseover', this._onOver)
    target.on('mouseleave', this._onLeave)
  }

  /** Reveal now, skipping `showDelay`. */
  show = (): void => {
    this._clearTimers()
    showTooltip(this._anchor(), this._text, this._align)
    this._visible = true
  }

  /** Hide now, skipping `hideDelay`. */
  hide = (): void => {
    this._clearTimers()
    hideTooltip()
    this._visible = false
  }

  destroy(): void {
    this.hide()
    this._target.off('mouseover', this._onOver)
    this._target.off('mouseleave', this._onLeave)
  }

  // `mouseover` bubbles from the target's children, so an already-armed or
  // visible tooltip must not restart its show timer.
  _onOver = (): void => {
    this._clearHideTimer()
    if (this._visible || this._showTimer !== null) {
      return
    }
    if (this._showDelay <= 0) {
      this.show()
      return
    }
    this._showTimer = setTimeout(() => {
      this._showTimer = null
      this.show()
    }, this._showDelay)
  }

  _onLeave = (): void => {
    this._clearShowTimer()
    if (!this._visible) {
      return
    }
    if (this._hideDelay <= 0) {
      this.hide()
      return
    }
    this._hideTimer = setTimeout(() => {
      this._hideTimer = null
      this.hide()
    }, this._hideDelay)
  }

  _clearTimers(): void {
    this._clearShowTimer()
    this._clearHideTimer()
  }

  _clearShowTimer(): void {
    if (this._showTimer !== null) {
      clearTimeout(this._showTimer)
      this._showTimer = null
    }
  }

  _clearHideTimer(): void {
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer)
      this._hideTimer = null
    }
  }
}
