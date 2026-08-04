import type Konva from 'konva'
import type { IVec2, Workspace } from '@0x-jerry/golden-graph'
import { LAYER_NAME } from '../constants'

export type OverlayLayer = typeof LAYER_NAME.EDGES | typeof LAYER_NAME.NODES

/**
 * Shared dependencies handed to each gesture handler. Layer resolution and
 * redrawing is delegated to the caller via `renderOverlay`.
 */
export interface GestureContext {
  stage: Konva.Stage
  ws: Workspace
  renderOverlay(shape: Konva.Group | Konva.Shape, layer: OverlayLayer): void
}

/** A pointer gesture the InteractionManager routes move/end events to. */
export interface IGesture {
  move(screenPos: IVec2): void
  end(): void
}
