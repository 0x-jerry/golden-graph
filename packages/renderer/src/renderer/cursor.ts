import type Konva from 'konva'

/**
 * Set the stage container's CSS cursor. Konva v10 no longer applies the shape
 * `cursor` config, so it must be set on the shared stage content element
 * manually. The cursor is a single DOM element shared by the whole stage, so
 * any hover state must clear it on `mouseout` / destroy.
 */
export function setStageCursor(node: Konva.Node, cursor: string) {
  const stage = node.getStage()
  if (stage) stage.content.style.cursor = cursor
}

/** Clear the stage container's CSS cursor. */
export function resetStageCursor(node: Konva.Node) {
  setStageCursor(node, '')
}
