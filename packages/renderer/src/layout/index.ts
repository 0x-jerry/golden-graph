import type { Node, Workspace, IVec2 } from '@0x-jerry/golden-graph'
import { computeNodePositions } from './engine'
import { DEFAULT_DRAW, type LayoutOptions, type LayoutResult } from './types'

export { computeNodePositions, resolveEdgeDirection } from './engine'
export * from './types'

/**
 * Padding around a group's child bounding box used when re-fitting the group
 * after layout. Mirrors `GroupManager.addGroup`.
 */
const GROUP_PADDING = 40
const GROUP_HEADER_HEIGHT = 50

/**
 * Lay out every node in the active workspace and apply the result.
 *
 * Mutates node positions via `node.moveTo` (each emits `node:changed`, so the
 * renderer redraws automatically) and re-fits every group to its children.
 * The whole graph is translated so its center lands near the viewport center
 * instead of starting at the canvas origin.
 *
 * No-op while the workspace is disabled (e.g. an executor run is in progress).
 *
 * Returns the bounding box of the laid-out nodes so callers can frame it.
 */
export function autoLayout(ws: Workspace, options: LayoutOptions = {}): LayoutResult {
  if (ws.disabled) {
    return {
      positions: new Map(),
      rect: { x: 0, y: 0, width: 0, height: 0 },
    }
  }

  const result = computeNodePositions(ws.nodes, ws.edges, options)
  const measure = options.measure ?? estimateSize

  const offset = centeringOffset(ws, result)

  const positions = new Map<number, IVec2>()
  result.positions.forEach((pos, id) => {
    positions.set(id, { x: pos.x + offset.x, y: pos.y + offset.y })
  })

  positions.forEach((pos, id) => {
    const node = ws.getNode(id)
    node?.moveTo(pos.x, pos.y)
  })

  fitGroups(ws, positions, measure)

  return {
    positions,
    rect: {
      x: result.rect.x + offset.x,
      y: result.rect.y + offset.y,
      width: result.rect.width,
      height: result.rect.height,
    },
  }
}

/**
 * Compute the workspace-space translation that lands the layout's center on
 * the viewport center. Falls back to no translation when there is no renderer
 * or its viewport center is unavailable.
 */
function centeringOffset(ws: Workspace, result: LayoutResult): IVec2 {
  const renderer = ws.renderer
  if (!renderer?.getViewportCenter) {
    return { x: 0, y: 0 }
  }

  const screenCenter = renderer.getViewportCenter()
  if (!Number.isFinite(screenCenter.x) || !Number.isFinite(screenCenter.y)) {
    return { x: 0, y: 0 }
  }

  const viewportCenter = ws.coord.convertScreenCoord(screenCenter)

  return {
    x: viewportCenter.x - (result.rect.x + result.rect.width / 2),
    y: viewportCenter.y - (result.rect.y + result.rect.height / 2),
  }
}

/**
 * Re-position and re-size each group so it bounds its contained nodes with the
 * standard padding and header. Bounds come from the laid-out positions plus
 * the measured node sizes.
 */
function fitGroups(
  ws: Workspace,
  positions: Map<number, IVec2>,
  measure: (node: Node) => { width: number; height: number },
) {
  for (const group of ws.groups) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let found = false

    for (const nodeId of group.nodes) {
      const pos = positions.get(nodeId)
      const node = ws.getNode(nodeId)
      if (!pos || !node) continue

      const size = measure(node)
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + size.width)
      maxY = Math.max(maxY, pos.y + size.height)
      found = true
    }

    if (!found) continue

    group.setPos({
      x: minX - GROUP_PADDING,
      y: minY - GROUP_PADDING - GROUP_HEADER_HEIGHT,
    })
    group.setSize({
      x: maxX - minX + GROUP_PADDING * 2,
      y: maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER_HEIGHT,
    })
  }
}

/**
 * Default size estimator for when no `measure` is provided.
 */
function estimateSize(node: Node): { width: number; height: number } {
  const handleRows = Math.max(node.handles.length, 1)
  return {
    width: DEFAULT_DRAW.nodeWidth,
    height:
      DEFAULT_DRAW.headerHeight +
      handleRows * DEFAULT_DRAW.handleRowHeight +
      DEFAULT_DRAW.bodyPadding,
  }
}