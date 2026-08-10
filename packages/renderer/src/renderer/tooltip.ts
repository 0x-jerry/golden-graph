import type Konva from 'konva'

/** Hover time (ms) before a handle's description tooltip appears. */
export const TOOLTIP_DELAY = 500

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
