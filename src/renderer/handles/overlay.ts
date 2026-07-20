import type Konva from 'konva'
import type { NodeHandle } from '../../core'

/**
 * Position an HTML overlay element (input/select) over a Konva node.
 *
 * NOTE: `getAbsolutePosition()` already includes the stage transform
 * (position AND scale), so the result is in stage-container pixels —
 * it must NOT be scaled again. Only the overlay size is scaled, since
 * the given width/height are in workspace units.
 *
 * @returns `false` when the anchor is not attached to a stage.
 */
export function positionOverlay(
  el: HTMLElement,
  anchor: Konva.Node,
  width: number,
  height: number,
): boolean {
  const stage = anchor.getStage()
  if (!stage) return false

  const container = stage.container()
  const absPos = anchor.getAbsolutePosition()
  const scale = stage.scaleX()
  const rect = container.getBoundingClientRect()

  el.style.left = `${rect.left + absPos.x - 2 * scale}px`
  el.style.top = `${rect.top + absPos.y - 2 * scale}px`
  el.style.width = `${width * scale + 4}px`
  el.style.height = `${height * scale + 2}px`
  el.style.fontSize = `${12 * scale}px`
  el.style.display = 'block'

  return true
}

/**
 * Close the active overlay when the canvas coordinate system changes
 * (pan/zoom), since the overlay cannot track its anchor reliably.
 *
 * @returns An unsubscribe function.
 */
export function closeOverlayOnCoordChange(
  handle: NodeHandle,
  close: () => void,
) {
  return handle.node.workspace.events.on('coord:changed', close)
}
