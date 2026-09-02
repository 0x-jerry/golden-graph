import type { Workspace } from '@0x-jerry/golden-graph'
import { autoLayout, type LayoutResult } from '../layout'
import { getNodeWidth } from './constants'
import { getNodeHeight } from './NodeView'
import { handleY } from './handles/layout'

/**
 * Lay out every node in the workspace using the renderer's default node
 * sizing and handle alignment. Callers that need to override gaps or sizing
 * use the flexible {@link autoLayout} directly.
 */
export function layoutWorkspace(ws: Workspace): LayoutResult {
  return autoLayout(ws, {
    measure: (node) => ({
      width: getNodeWidth(node),
      height: getNodeHeight(node),
    }),
    getHandleY: handleY,
  })
}