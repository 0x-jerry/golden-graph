import type { Edge, Node, NodeHandle, IVec2 } from '@0x-jerry/golden-graph'
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
 * Lay out one weakly-connected component with Dagre: within-rank order follows
 * handle rows when known (see {@link buildOrderConstraints}), nodes flow
 * left→right along the resolvable edges.
 */
function dagreLayoutComponent(
  ids: number[],
  byId: Map<number, SizedNode>,
  edges: readonly Edge[],
  opts: {
    xGap: number
    yGap: number
    getHandleY?: (node: Node, handle: NodeHandle) => number
  },
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

  directedEdges(idSet, edges).forEach(({ from, to }) => {
    g.setEdge(String(from), String(to), {})
  })

  const constraints = opts.getHandleY
    ? buildOrderConstraints(idSet, byId, edges, opts.getHandleY)
    : []
  dagreLayout(g, { constraints })

  // Dagre positions each node by its center; convert back to top-left corners.
  const placed = ids.map((id) => {
    const size = byId.get(id)!.size
    const n = g.node(String(id))
    return {
      id,
      x: n.x - size.width / 2,
      y: n.y - size.height / 2,
    }
  })

  if (opts.getHandleY) {
    alignHandleRows(placed, byId, edges, opts.getHandleY, opts.yGap)
  }

  return placed
}

interface HandleConstraint {
  other: number
  delta: number
}

interface DirectedEdge {
  from: number
  to: number
  hFrom: NodeHandle
  hTo: NodeHandle
}

/**
 * Directionally-resolvable edges of a component, with the handle each endpoint
 * attaches to. Same-side and self edges are dropped (they cannot give a
 * direction); their nodes are still grouped by {@link findComponents}.
 */
function directedEdges(
  ids: Set<number>,
  edges: readonly Edge[],
): DirectedEdge[] {
  const out: DirectedEdge[] = []
  edges.forEach((edge) => {
    const dir = resolveEdgeDirection(edge)
    if (!dir) return
    const [from, to] = dir
    if (from === to || !ids.has(from) || !ids.has(to)) return
    const hFrom = edge.start.isRight ? edge.start : edge.end
    const hTo = hFrom === edge.start ? edge.end : edge.start
    out.push({ from, to, hFrom, hTo })
  })
  return out
}

/**
 * Order constraints for Dagre's within-rank ordering, derived from handle
 * rows: for every node, nodes connected by a higher (smaller-Y) handle must be
 * ordered above nodes connected by a lower handle. This keeps connected nodes
 * reading top→bottom in the same order as the handles they attach to, instead
 * of letting Dagre's crossing heuristics place them arbitrarily.
 *
 * Constraints reference node ids as strings (Dagre keys); pairs on different
 * ranks are ignored by Dagre itself.
 */
function buildOrderConstraints(
  idSet: Set<number>,
  byId: Map<number, SizedNode>,
  edges: readonly Edge[],
  getHandleY: (node: Node, handle: NodeHandle) => number,
): { left: string; right: string }[] {
  const outgoing = new Map<number, { other: number; y: number }[]>()
  const incoming = new Map<number, { other: number; y: number }[]>()

  const push = (
    map: Map<number, { other: number; y: number }[]>,
    id: number,
    other: number,
    y: number,
  ) => {
    let list = map.get(id)
    if (!list) {
      list = []
      map.set(id, list)
    }
    list.push({ other, y })
  }

  directedEdges(idSet, edges).forEach(({ from, to, hFrom, hTo }) => {
    const yFrom = getHandleY(byId.get(from)!.node, hFrom)
    const yTo = getHandleY(byId.get(to)!.node, hTo)
    push(outgoing, from, to, yFrom)
    push(incoming, to, from, yTo)
  })

  const constraints: { left: string; right: string }[] = []
  ;[outgoing, incoming].forEach((map) => {
    map.forEach((list) => {
      list.sort((a, b) => a.y - b.y)
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1]!
        const cur = list[i]!
        // Two edges sharing a node: the one on the higher handle is ordered
        // first. Ties (same row) get no constraint.
        if (prev.y !== cur.y) {
          constraints.push({
            left: String(prev.other),
            right: String(cur.other),
          })
        }
      }
    })
  })

  return constraints
}

/**
 * Shift node Y positions within a component so each directionally-resolvable
 * edge's two handle joints share the same height (`yA + offsetA === yB +
 * offsetB`), then re-enforce vertical separation within each rank. The
 * constraint system is over-constrained in general (cycles, fan-in/out), so it
 * is solved as a damped Jacobi relaxation: every node adopts the average of
 * the positions its edges demand. Ranks are separated by pushing nodes down,
 * in the pre-alignment order, to at least their predecessor's bottom plus
 * `yGap`.
 */
function alignHandleRows(
  placed: { id: number; x: number; y: number }[],
  byId: Map<number, SizedNode>,
  edges: readonly Edge[],
  getHandleY: (node: Node, handle: NodeHandle) => number,
  yGap: number,
) {
  const idSet = new Set(placed.map((p) => p.id))
  const yOf = new Map<number, number>()
  placed.forEach((p) => yOf.set(p.id, p.y))

  const constraints = new Map<number, HandleConstraint[]>()
  const pushConstraint = (id: number, other: number, delta: number) => {
    let list = constraints.get(id)
    if (!list) {
      list = []
      constraints.set(id, list)
    }
    list.push({ other, delta })
  }

  directedEdges(idSet, edges).forEach(({ from, to, hFrom, hTo }) => {
    const delta =
      getHandleY(byId.get(from)!.node, hFrom) -
      getHandleY(byId.get(to)!.node, hTo)

    // desired: yTo = yFrom + delta
    pushConstraint(to, from, delta)
    pushConstraint(from, to, -delta)
  })

  if (!constraints.size) return

  // Damped Jacobi toward the Y each node's edges demand: `y ← y + 0.5(target
  // − y)`, all nodes updated simultaneously. Constraints only fix relative Y
  // (translating the whole component satisfies them too), so absolute drift is
  // possible but harmless — the caller re-normalizes the component rect
  // afterwards. Iterate enough to propagate a demand across the whole
  // component; over-constrained graphs settle on a compromise.
  const factor = 0.5
  for (let i = 0; i < Math.max(16, placed.length * 2); i++) {
    const next = new Map<number, number>()
    placed.forEach((p) => {
      const list = constraints.get(p.id)
      if (!list) {
        next.set(p.id, yOf.get(p.id)!)
        return
      }
      let sum = 0
      for (const c of list) {
        sum += yOf.get(c.other)! + c.delta
      }
      const target = sum / list.length
      const current = yOf.get(p.id)!
      next.set(p.id, current + factor * (target - current))
    })
    next.forEach((y, id) => yOf.set(id, y))
  }

  // Re-separate each rank (nodes sharing the same x) top→bottom: push a node
  // down so it never climbs into the node above it. Sorted by the pre-alignment
  // Y (dagre's vertical order), so rank order stays stable even though the
  // relaxed Ys land near-identical for aligned rows.
  const byColumn = new Map<number, { id: number; x: number; y: number }[]>()
  placed.forEach((p) => {
    let column = byColumn.get(p.x)
    if (!column) {
      column = []
      byColumn.set(p.x, column)
    }
    column.push(p)
  })
  byColumn.forEach((column) => {
    column.sort((a, b) => a.y - b.y)
    for (let i = 1; i < column.length; i++) {
      const prev = column[i - 1]!
      const cur = column[i]!
      const minY = yOf.get(prev.id)! + byId.get(prev.id)!.size.height + yGap
      if (yOf.get(cur.id)! < minY) {
        yOf.set(cur.id, minY)
      }
    }
  })

  placed.forEach((p) => {
    p.y = yOf.get(p.id)!
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
