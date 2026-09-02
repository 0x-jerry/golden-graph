import type { Edge, Node, IVec2 } from '@0x-jerry/golden-graph'
import { graphlib, layout as dagreLayout } from '@dagrejs/dagre'
import { DEFAULT_DRAW, DEFAULT_OPTIONS, type LayoutOptions, type LayoutResult } from './types'

interface SizedNode {
  node: Node
  size: { width: number; height: number }
}

/**
 * Resolve the flow direction of a single edge from its endpoint handle
 * positions.
 *
 * An edge connects a producer (Right/output handle) to a consumer
 * (Left/input handle). `edge.start`/`edge.end` order is *not* reliable, so
 * direction is derived purely from handle position. When both endpoints are
 * on the same side we cannot infer a direction — that edge contributes no
 * ranking constraint (it is still used for component detection).
 *
 * Returns `[fromId, toId]` or `null` when the direction is ambiguous.
 */
export function resolveEdgeDirection(edge: Edge): [number, number] | null {
  const a = edge.start
  const b = edge.end

  if (a.isRight && b.isLeft) {
    return [a.node.id, b.node.id]
  }

  if (a.isLeft && b.isRight) {
    return [b.node.id, a.node.id]
  }

  return null
}

/**
 * Pure layout engine: compute absolute positions for a set of nodes and their
 * edges without mutating anything. Runs Dagre's layered layout per connected
 * component, then stacks components top→bottom sharing the same flow axis.
 */
export function computeNodePositions(
  nodes: readonly Node[],
  edges: readonly Edge[],
  options: LayoutOptions = {},
): LayoutResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const measure = opts.measure ?? estimateSize
  const sized = nodes.map((node) => ({ node, size: measure(node) }))

  const positions = new Map<number, IVec2>()

  if (!sized.length) {
    return {
      positions,
      rect: { x: 0, y: 0, width: 0, height: 0 },
    }
  }

  const byId = new Map<number, SizedNode>()
  sized.forEach((s) => byId.set(s.node.id, s))

  const components = findComponents(sized, edges)

  // Each batch — a single node or a connected component — flows left→right
  // internally. Batches are then stacked top→bottom, so groups read as a
  // column while each keeps its own left→right flow.
  let cursor = 0
  let overall: Rect | null = null

  const record = (id: number, x: number, y: number) => {
    positions.set(id, { x, y })
    const size = byId.get(id)!.size
    overall = overall
      ? unionRect(overall, box(x, y, size.width, size.height))
      : box(x, y, size.width, size.height)
  }

  components.forEach((ids) => {
    const placed = dagreLayoutComponent(ids, byId, edges, opts)
    const rect = componentRect(placed, byId)

    placed.forEach((item) => {
      record(item.id, item.x - rect.x, cursor + (item.y - rect.y))
    })

    cursor += rect.height + opts.componentGap
  })

  return {
    positions,
    rect: overall ?? box(0, 0, 0, 0),
  }
}

/**
 * Partition nodes into weakly-connected components (union-find over all
 * undirected edges, regardless of inferred direction). Isolated nodes form
 * their own component.
 */
function findComponents(
  sized: SizedNode[],
  edges: readonly Edge[],
): number[][] {
  const parent = new Map<number, number>()
  sized.forEach((s) => parent.set(s.node.id, s.node.id))

  const find = (x: number): number => {
    let root = parent.get(x)!
    while (root !== parent.get(root)) {
      root = parent.get(root)!
    }
    return root
  }

  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) {
      parent.set(rb, ra)
    }
  }

  edges.forEach((edge) => {
    const a = edge.start.node.id
    const b = edge.end.node.id
    if (parent.has(a) && parent.has(b)) {
      union(a, b)
    }
  })

  const groups = new Map<number, number[]>()
  sized.forEach((s) => {
    const root = find(s.node.id)
    const list = groups.get(root)
    if (list) {
      list.push(s.node.id)
    } else {
      groups.set(root, [s.node.id])
    }
  })

  return Array.from(groups.values())
}

/**
 * Lay out one weakly-connected component with Dagre. Only directionally
 * resolvable edges constrain the ranks; same-side and self edges are omitted
 * from Dagre (they cannot give a direction) but their nodes were already
 * grouped into the same component by {@link findComponents}.
 */
function dagreLayoutComponent(
  ids: number[],
  byId: Map<number, SizedNode>,
  edges: readonly Edge[],
  opts: { xGap: number; yGap: number },
): { id: number; x: number; y: number }[] {
  const idSet = new Set(ids)
  const g = new graphlib.Graph()
  g.setGraph({
    rankdir: 'LR',
    nodesep: opts.yGap,
    ranksep: opts.xGap,
    marginx: 0,
    marginy: 0,
  })
  g.setDefaultEdgeLabel(() => ({}))

  ids.forEach((id) => {
    const size = byId.get(id)!.size
    g.setNode(String(id), { width: size.width, height: size.height })
  })

  edges.forEach((edge) => {
    const dir = resolveEdgeDirection(edge)
    if (!dir) return
    const [from, to] = dir
    if (from === to || !idSet.has(from) || !idSet.has(to)) return
    g.setEdge(String(from), String(to), {})
  })

  dagreLayout(g)

  // Dagre positions each node by its center; convert back to top-left corners.
  return ids.map((id) => {
    const size = byId.get(id)!.size
    const n = g.node(String(id))
    return {
      id,
      x: n.x - size.width / 2,
      y: n.y - size.height / 2,
    }
  })
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

function box(x: number, y: number, width: number, height: number) {
  return { x, y, width, height }
}

/**
 * Bounding box of a placed component, including each node's full footprint
 * (origin + measured extent) rather than just its origin point. Used to
 * advance the cursor so consecutive components never overlap.
 */
function componentRect(
  placed: { id: number; x: number; y: number }[],
  byId: Map<number, SizedNode>,
) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const item of placed) {
    const size = byId.get(item.id)!.size
    minX = Math.min(minX, item.x)
    minY = Math.min(minY, item.y)
    maxX = Math.max(maxX, item.x + size.width)
    maxY = Math.max(maxY, item.y + size.height)
  }

  return box(minX, minY, maxX - minX, maxY - minY)
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Smallest box containing two boxes.
 */
function unionRect(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.width, b.x + b.width)
  const maxY = Math.max(a.y + a.height, b.y + b.height)
  return box(minX, minY, maxX - minX, maxY - minY)
}
