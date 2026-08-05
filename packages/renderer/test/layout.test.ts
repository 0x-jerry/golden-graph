import { describe, it, expect } from 'vitest'
import {
  Edge,
  HandlePosition,
  NodeType,
  Workspace,
  type NodeHandle,
} from '@0x-jerry/golden-graph'
import { autoLayout, computeNodePositions, resolveEdgeDirection } from '../src/layout'
import type { LayoutOptions } from '../src/layout'

interface TestNodeSchema {
  type: string
  name: string
  nodeType?: NodeType
  handles: Array<{
    key: string
    position: HandlePosition
    type: string
    name?: string
  }>
}

const sourceSchema: TestNodeSchema = {
  type: 'Source',
  name: 'Source',
  nodeType: NodeType.Entry,
  handles: [{ key: 'out', position: HandlePosition.Right, type: 'number', name: 'out' }],
}

const passSchema: TestNodeSchema = {
  type: 'Pass',
  name: 'Pass',
  handles: [
    { key: 'in', position: HandlePosition.Left, type: 'number', name: 'in' },
    { key: 'out', position: HandlePosition.Right, type: 'number', name: 'out' },
  ],
}

const sinkSchema: TestNodeSchema = {
  type: 'Sink',
  name: 'Sink',
  handles: [{ key: 'in', position: HandlePosition.Left, type: 'number', name: 'in' }],
}

function makeWorkspace() {
  const ws = new Workspace()
  ws.registerNodeSchema(sourceSchema)
  ws.registerNodeSchema(passSchema)
  ws.registerNodeSchema(sinkSchema)
  return ws
}

function chain(schemas: TestNodeSchema[]) {
  const ws = makeWorkspace()
  const nodes = schemas.map((s) => ws.addNode(s.type))
  for (let i = 0; i < nodes.length - 1; i++) {
    ws.connect(nodes[i]!.getHandle('out')!, nodes[i + 1]!.getHandle('in')!)
  }
  return { ws, nodes }
}

const measure = (_n: unknown) => ({ width: 100, height: 50 })

/** Non-null array element helper for `noUncheckedIndexedAccess`. */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i]
  if (!v) throw new Error(`missing element at index ${i}`)
  return v
}

/**
 * Build an edge directly (bypassing `connect`, which blocks same-position
 * handles) to model graphs the layout must still tolerate.
 */
function rawConnect(ws: Workspace, a: NodeHandle, b: NodeHandle) {
  const edge = new Edge()
  edge.setWorkspace(ws)
  edge.id = ws.nextId()
  edge.setEndpoints(a, b)
  ws._addEdge(edge)
  return edge
}

describe('resolveEdgeDirection', () => {
  it('resolves a Right→Left edge to producer→consumer', () => {
    const { ws, nodes } = chain([sourceSchema, sinkSchema])
    const edge = ws.queryConnectedEdges(at(nodes, 0).id)[0]!
    expect(resolveEdgeDirection(edge)).toEqual([at(nodes, 0).id, at(nodes, 1).id])
  })

  it('still resolves direction when edge endpoints are written reversed', () => {
    const ws = makeWorkspace()
    const a = ws.addNode(sourceSchema.type)
    const b = ws.addNode(sinkSchema.type)
    ws.connect(a.getHandle('out')!, b.getHandle('in')!)
    const edge = ws.queryConnectedEdges(a.id)[0]!
    // start/end order is unreliable, but direction must come from positions.
    expect(resolveEdgeDirection(edge)).toEqual([a.id, b.id])
  })

  it('returns null when both endpoints are on the same side', () => {
    const ws = makeWorkspace()
    const a = ws.addNode(passSchema.type)
    const b = ws.addNode(passSchema.type)
    rawConnect(ws, a.getHandle('out')!, b.getHandle('out')!)
    const edge = ws.queryConnectedEdges(a.id)[0]!
    expect(resolveEdgeDirection(edge)).toBeNull()
  })
})

describe('computeNodePositions', () => {
  it('lays a linear chain in increasing rank along the main axis', () => {
    const { ws, nodes } = chain([sourceSchema, passSchema, sinkSchema])
    const { positions } = computeNodePositions(ws.nodes, ws.edges, { measure })

    const p0 = positions.get(at(nodes, 0).id)!
    const p1 = positions.get(at(nodes, 1).id)!
    const p2 = positions.get(at(nodes, 2).id)!

    expect(p1.x).toBeGreaterThan(p0.x)
    expect(p2.x).toBeGreaterThan(p1.x)
    expect(p1.y).toBe(p0.y)
    expect(p2.y).toBe(p1.y)
  })

  it('stacks fan-out consumers vertically in the same rank, spaced by yGap', () => {
    const ws = makeWorkspace()
    const src = ws.addNode(sourceSchema.type)
    const c1 = ws.addNode(sinkSchema.type)
    const c2 = ws.addNode(sinkSchema.type)
    ws.connect(src.getHandle('out')!, c1.getHandle('in')!)
    ws.connect(src.getHandle('out')!, c2.getHandle('in')!)

    const opts: LayoutOptions = { measure, yGap: 40 }
    const { positions } = computeNodePositions(ws.nodes, ws.edges, opts)

    const ps = positions.get(src.id)!
    const p1 = positions.get(c1.id)!
    const p2 = positions.get(c2.id)!

    // Consumers land in the next rank (same x), stacked vertically.
    expect(ps.x).toBeLessThan(p1.x)
    expect(p1.x).toBe(p2.x)
    expect(Math.abs(p1.y - p2.y)).toBeGreaterThanOrEqual(40)
  })

  it('keeps nodes connected by a same-side edge in the same rank', () => {
    const ws = makeWorkspace()
    const a = ws.addNode(passSchema.type)
    const b = ws.addNode(passSchema.type)
    rawConnect(ws, a.getHandle('out')!, b.getHandle('out')!)

    const { positions } = computeNodePositions(ws.nodes, ws.edges, { measure })
    const p0 = positions.get(a.id)!
    const p1 = positions.get(b.id)!

    expect(p0.x).toBe(p1.x)
  })

  it('does not overlap nodes within a rank', () => {
    const ws = makeWorkspace()
    const src = ws.addNode(sourceSchema.type)
    for (let i = 0; i < 6; i++) {
      const s = ws.addNode(sinkSchema.type)
      ws.connect(src.getHandle('out')!, s.getHandle('in')!)
    }

    const { positions } = computeNodePositions(ws.nodes, ws.edges, { measure })
    const sameRank = Array.from(positions.values()).filter(
      (p) => p.x === positions.get(src.id)!.x,
    )
    const ys = sameRank.map((p) => p.y).sort((a, b) => a - b)

    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(50)
    }
  })

  it('terminates on a cyclic graph and assigns every node a position', () => {
    const ws = makeWorkspace()
    const a = ws.addNode(passSchema.type)
    const b = ws.addNode(passSchema.type)
    ws.connect(a.getHandle('out')!, b.getHandle('in')!)
    ws.connect(b.getHandle('out')!, a.getHandle('in')!)

    const { positions } = computeNodePositions(ws.nodes, ws.edges, { measure })

    expect(positions.size).toBe(2)
    expect(positions.get(a.id)).toBeDefined()
    expect(positions.get(b.id)).toBeDefined()
  })

  it('supports the down (top-to-bottom) direction', () => {
    const { ws, nodes } = chain([sourceSchema, passSchema, sinkSchema])
    const { positions } = computeNodePositions(ws.nodes, ws.edges, {
      direction: 'down',
      measure,
    })

    const p0 = positions.get(at(nodes, 0).id)!
    const p1 = positions.get(at(nodes, 1).id)!
    const p2 = positions.get(at(nodes, 2).id)!

    expect(p1.y).toBeGreaterThan(p0.y)
    expect(p2.y).toBeGreaterThan(p1.y)
    expect(p1.x).toBe(p0.x)
    expect(p2.x).toBe(p1.x)
  })

  it('separates disconnected components with componentGap', () => {
    const ws = makeWorkspace()
    const srcA = ws.addNode(sourceSchema.type)
    const sinkA = ws.addNode(sinkSchema.type)
    ws.connect(srcA.getHandle('out')!, sinkA.getHandle('in')!)
    const srcB = ws.addNode(sourceSchema.type)

    const { positions } = computeNodePositions(ws.nodes, ws.edges, {
      measure,
      componentGap: 80,
    })

    const minXA = Math.min(positions.get(srcA.id)!.x, positions.get(sinkA.id)!.x)
    const maxXA = Math.max(positions.get(srcA.id)!.x, positions.get(sinkA.id)!.x)
    const xB = positions.get(srcB.id)!.x

    expect(xB).toBeGreaterThan(maxXA)
    expect(xB - maxXA).toBeGreaterThanOrEqual(80)
    expect(minXA).toBeGreaterThanOrEqual(0)
  })

  it('spaces isolated (unconnected) nodes so they never overlap', () => {
    const ws = makeWorkspace()
    const n1 = ws.addNode(sourceSchema.type)
    const n2 = ws.addNode(sourceSchema.type)
    const n3 = ws.addNode(sourceSchema.type)

    const { positions } = computeNodePositions(ws.nodes, ws.edges, {
      measure,
      componentGap: 80,
    })

    const xs = [n1, n2, n3].map((n) => positions.get(n.id)!.x).sort((a, b) => a - b)
    // Each node is 100 wide; consecutive isolated components must be separated
    // by more than a node's width (footprint includes extents, not just origins).
    expect(xs[1]!).toBeGreaterThanOrEqual(xs[0]! + 100 + 80)
    expect(xs[2]!).toBeGreaterThanOrEqual(xs[1]! + 100 + 80)
  })
})

describe('autoLayout', () => {
  it('applies positions to the workspace nodes', () => {
    const { ws, nodes } = chain([sourceSchema, passSchema, sinkSchema])
    ws.nodes.forEach((n) => n.moveTo(0, 0))

    autoLayout(ws, { measure })

    const p0 = at(nodes, 0).pos
    const p1 = at(nodes, 1).pos
    const p2 = at(nodes, 2).pos

    // Ranks flow left → right: downstream nodes move along the main axis.
    expect(p0.x).toBe(0)
    expect(p1.x).toBeGreaterThan(p0.x)
    expect(p2.x).toBeGreaterThan(p1.x)
    expect(p2.y).toBe(p0.y)
  })

  it('fits groups to their contained nodes', () => {
    const { ws, nodes } = chain([sourceSchema, passSchema, sinkSchema])
    ws.nodes.forEach((n) => n.moveTo(0, 0))

    // `addGroup` computes the initial bounds via the renderer.
    ws.setRenderer({
      getNodesBounding: (ids) => {
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const id of ids) {
          const n = ws.getNode(id)!
          minX = Math.min(minX, n.pos.x)
          minY = Math.min(minY, n.pos.y)
          maxX = Math.max(maxX, n.pos.x + 100)
          maxY = Math.max(maxY, n.pos.y + 50)
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      },
    })

    ws.addGroup(nodes.map((n) => n.id))
    autoLayout(ws, { measure })

    const group = ws.groups[0]!
    for (const id of group.nodes) {
      const n = ws.getNode(id)!
      expect(n.pos.x).toBeGreaterThanOrEqual(group.pos.x)
      expect(n.pos.y).toBeGreaterThanOrEqual(group.pos.y)
      expect(n.pos.x + 100).toBeLessThanOrEqual(group.pos.x + group.size.x)
      expect(n.pos.y + 50).toBeLessThanOrEqual(group.pos.y + group.size.y)
    }
  })

  it('is a no-op while the workspace is disabled', () => {
    const { ws, nodes } = chain([sourceSchema, passSchema, sinkSchema])
    nodes.forEach((n) => n.moveTo(0, 0))
    const orig = nodes.map((n) => ({ ...n.pos }))

    ws._state.disabled = true
    autoLayout(ws, { measure })

    expect(nodes.map((n) => n.pos)).toEqual(orig)
  })

  it('centers the laid-out graph on the viewport center', () => {
    const { ws, nodes } = chain([sourceSchema, passSchema, sinkSchema])
    ws.nodes.forEach((n) => n.moveTo(0, 0))

    ws.setRenderer({
      getNodesBounding: (ids) => {
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const id of ids) {
          const n = ws.getNode(id)!
          minX = Math.min(minX, n.pos.x)
          minY = Math.min(minY, n.pos.y)
          maxX = Math.max(maxX, n.pos.x + 100)
          maxY = Math.max(maxY, n.pos.y + 50)
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      },
      // Stage/screen center; coord scale 1 => same in workspace units.
      getViewportCenter: () => ({ x: 500, y: 400 }),
    })

    const result = autoLayout(ws, { measure })

    const centerX = result.rect.x + result.rect.width / 2
    const centerY = result.rect.y + result.rect.height / 2
    expect(centerX).toBeCloseTo(500)
    expect(centerY).toBeCloseTo(400)

    // Nodes no longer start at the top-left origin.
    expect(at(nodes, 0).pos.y).toBeGreaterThan(0)
    expect(at(nodes, 0).pos.y).not.toBe(0)
  })
})