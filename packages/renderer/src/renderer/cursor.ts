import type Konva from 'konva'

/**
 * Cursor each hoverable element should show while the pointer is over it.
 * Populated on creation so it survives re-renders that destroy and recreate
 * the element (WeakMap — entries are collected with their nodes).
 */
const cursorByNode = new WeakMap<Konva.Node, string>()

/** Declare the cursor an element shows while hovered (call at creation). */
export function registerStageCursor(node: Konva.Node, cursor: string) {
  cursorByNode.set(node, cursor)
}

/**
 * Re-compute the cursor for whatever is under the pointer. Hit-tests the
 * stage and walks the ancestor chain to the first registered element, then
 * applies its cursor (or clears to `''` when nothing registered is under the
 * pointer). This is the single decision point — elements only register
 * themselves, they never attach their own `mouseover`/`mouseout` listeners.
 */
export function applyStageCursor(stage: Konva.Stage) {
  const pos = stage.getPointerPosition()
  // Konva keeps the last known pointer position after the pointer leaves the
  // stage (only `_pointerPositions`, not `_changedPointerPositions`, is
  // cleared on `pointerleave`). Bail when it is outside the stage so a redraw
  // can't re-apply a stale cursor after `onLeave` already cleared it.
  if (
    !pos ||
    pos.x < 0 ||
    pos.y < 0 ||
    pos.x > stage.width() ||
    pos.y > stage.height()
  ) {
    return
  }
  let node: Konva.Node | null = stage.getIntersection(pos)
  while (node) {
    const cursor = cursorByNode.get(node)
    if (cursor) {
      stage.content.style.cursor = cursor
      return
    }
    node = node.getParent()
  }
  stage.content.style.cursor = ''
}

/**
 * Wire the cursor center onto a stage: a single `pointermove` recomputes the
 * cursor as the pointer moves, leaving the stage content clears it, and every
 * layer redraw re-asserts it (so a re-render that destroys/recreates the
 * hovered element restores its cursor even while the pointer is stationary).
 * Returns a disposer that removes all listeners.
 */
export function attachStageCursorCenter(stage: Konva.Stage): () => void {
  const onMove = () => applyStageCursor(stage)
  const onLeave = () => {
    stage.content.style.cursor = ''
  }

  // Konva fires each layer's `draw` at the end of its scene pass, *before* the
  // hit canvas is redrawn. Defer to a microtask so `getIntersection` reads the
  // just-updated hit canvas; dedupe layers drawing within the same tick. This
  // relies on Konva drawing the hit canvas synchronously right after the `draw`
  // event (Layer.draw = drawScene + drawHit) — re-verify on a Konva bump.
  let drawScheduled = false
  const onDraw = () => {
    if (drawScheduled) return
    drawScheduled = true
    queueMicrotask(() => {
      drawScheduled = false
      applyStageCursor(stage)
    })
  }

  stage.on('pointermove mousemove', onMove)
  // Mirror Konva, which binds both pointer and legacy mouse events.
  stage.content.addEventListener('pointerleave', onLeave)
  stage.content.addEventListener('mouseleave', onLeave)
  // A stage's children are always layers (Konva invariant). The center must be
  // attached after all layers are added to the stage so each one is covered.
  const layers = stage.children.slice()
  for (const layer of layers) layer.on('draw', onDraw)

  return () => {
    stage.off('pointermove mousemove', onMove)
    stage.content.removeEventListener('pointerleave', onLeave)
    stage.content.removeEventListener('mouseleave', onLeave)
    for (const layer of layers) layer.off('draw', onDraw)
  }
}
