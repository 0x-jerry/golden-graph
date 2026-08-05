import type { Edge, Node, IVec2 } from '@0x-jerry/golden-graph'
import { DEFAULT_DRAW, DEFAULT_OPTIONS, type LayoutOptions, type LayoutResult } from './types'

interface SizedNode {
  node: Node
  size: { width: number; height: number }
}

interface RankedNode {
  node: Node
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
 * edges without mutating anything.
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

  const outEdges = new Map<number, Map<number, Edge>>()
  const inEdges = new Map<number, Map<number, Edge>>()
  edges.forEach((edge) => {
    const dir = resolveEdgeDirection(edge)
    if (!dir) return

    const [from, to] = dir
    if (!byId.has(from) || !byId.has(to)) return

    let om = outEdges.get(from)
    if (!om) {
      om = new Map()
      outEdges.set(from, om)
    }
    om.set(to, edge)

    let im = inEdges.get(to)
    if (!im) {
      im = new Map()
      inEdges.set(to, im)
    }
    im.set(from, edge)
  })

  const components = findComponents(sized, edges)

  // Each batch — a single node or a connected component — flows left→right
  // internally (ranks as columns, nodes stacked vertically within a rank).
  // Batches are then stacked top→bottom, so groups read as a column while each
  // keeps its own left→right flow.
  let cursor = 0
  let overall: Rect = box(0, 0, 0, 0)
  let hasOverall = false

  const record = (id: number, x: number, y: number) => {
    positions.set(id, { x, y })
    const size = byId.get(id)!.size
    overall = hasOverall
      ? unionRect(overall, box(x, y, size.width, size.height))
      : box(x, y, size.width, size.height)
    hasOverall = true
  }

  const placeComponent = (ids: number[], cursor: number): number => {
    const ranks = rankNodes(ids, byId, inEdges)
    orderRanks(ranks, outEdges, inEdges)
    const placed = placeNodes(ranks, byId, opts)

    const rect = componentRect(placed, byId)

    placed.forEach((item) => {
      record(item.id, item.x - rect.x, cursor + (item.y - rect.y))
    })

    return cursor + rect.height + opts.componentGap
  }

  components.forEach((ids) => {
    cursor = placeComponent(ids, cursor)
  })

  return {
    positions,
    rect: overall,
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
 * Assign each node a rank equal to its distance from an in-degree-0 root
 * (longest path from any root). Nodes reached through a back edge collapse
 * onto an already-assigned rank (cycle-safe). Nodes in a pure cycle (no
 * roots) start from an arbitrary member.
 */
function rankNodes(
  ids: number[],
  byId: Map<number, SizedNode>,
  inEdges: Map<number, Map<number, Edge>>,
): RankedNode[][] {
  const idSet = new Set(ids)

  const rankOf = new Map<number, number>()
  const path = new Set<number>()

  const visit = (id: number): number => {
    const cached = rankOf.get(id)
    if (cached !== undefined) return cached
    if (path.has(id)) return 0

    path.add(id)
    let rank = 0
    inEdges.get(id)?.forEach((_, from) => {
      if (idSet.has(from)) {
        rank = Math.max(rank, 1 + visit(from))
      }
    })
    path.delete(id)

    rankOf.set(id, rank)
    return rank
  }

  // Roots first, then whatever is left (pure cycles).
  ids.forEach((id) => {
    if (!inEdges.has(id) || inEdges.get(id)!.size === 0) {
      visit(id)
    }
  })
  ids.forEach((id) => {
    if (rankOf.get(id) === undefined) {
      visit(id)
    }
  })

  const maxRank = Math.max(0, ...ids.map((id) => rankOf.get(id) ?? 0))
  const ranks: RankedNode[][] = Array.from({ length: maxRank + 1 }, () => [])
  ids.forEach((id) => {
    const rank = rankOf.get(id) ?? 0
    ranks[rank]!.push({ node: byId.get(id)!.node })
  })

  return ranks
}

/**
 * Order nodes within each rank to reduce edge crossings using a barycenter
 * heuristic, sweeping forward then backward a few times. Nodes without any
 * cross-rank neighbour are kept in their original relative order.
 */
function orderRanks(
  ranks: RankedNode[][],
  outEdges: Map<number, Map<number, Edge>>,
  inEdges: Map<number, Map<number, Edge>>,
) {
  const passes = 4
  for (let pass = 0; pass < passes; pass++) {
    const forward = pass % 2 === 0
    const scope = forward
      ? Array.from({ length: ranks.length }, (_, i) => i)
      : Array.from({ length: ranks.length }, (_, i) => ranks.length - 1 - i)

    for (const r of scope) {
      const rank = ranks[r]
      if (!rank || rank.length < 2) continue

      const barycenter = (nodeId: number): number => {
        const neighbours: number[] = []

        if (forward && r > 0) {
          ranks[r - 1]!.forEach((rn, i) => {
            if (inEdges.get(nodeId)?.has(rn.node.id)) neighbours.push(i)
          })
        } else if (!forward && r < ranks.length - 1) {
          ranks[r + 1]!.forEach((rn, i) => {
            if (outEdges.get(nodeId)?.has(rn.node.id)) neighbours.push(i)
          })
        }

        if (!neighbours.length) return -1
        return neighbours.reduce((a, b) => a + b, 0) / neighbours.length
      }

      const indexed = rank.map((rn, i) => ({ rn, i, b: barycenter(rn.node.id) }))

      indexed.sort((a, b) => {
        if (a.b === b.b) return a.i - b.i
        if (a.b === -1) return 1
        if (b.b === -1) return -1
        return a.b - b.b
      })

      ranks[r] = indexed.map((x) => x.rn)
    }
  }
}

/**
 * Assign coordinates. Ranks become columns: each rank's x is the accumulated
 * max width of the previous rank plus the gap; nodes within a rank are stacked
 * vertically (y) with the cross gap.
 */
function placeNodes(
  ranks: RankedNode[][],
  byId: Map<number, SizedNode>,
  opts: { xGap: number; yGap: number },
): { id: number; x: number; y: number }[] {
  const width = (id: number) => byId.get(id)!.size.width
  const height = (id: number) => byId.get(id)!.size.height

  const rankExtents = ranks.map((rank) =>
    Math.max(0, ...rank.map((rn) => width(rn.node.id))),
  )
  const rankOrigin: number[] = []
  let main = 0
  for (let i = 0; i < ranks.length; i++) {
    rankOrigin.push(main)
    main += rankExtents[i]! + opts.xGap
  }

  const out: { id: number; x: number; y: number }[] = []

  ranks.forEach((rank, r) => {
    let cross = 0
    rank.forEach((rn, i) => {
      if (i > 0) {
        cross += height(ranks[r]![i - 1]!.node.id) + opts.yGap
      }
      out.push({
        id: rn.node.id,
        x: rankOrigin[r]!,
        y: cross,
      })
    })
  })

  return out
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
 * Smallest box containing two boxes (a and b are boxes).
 */
function unionRect(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.width, b.x + b.width)
  const maxY = Math.max(a.y + a.height, b.y + b.height)
  return box(minX, minY, maxX - minX, maxY - minY)
}