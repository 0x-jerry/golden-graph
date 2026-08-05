import { describe, it, expect } from 'vitest'
import {
  Edge,
  Group,
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
    accepts: string
    name?: string
  }>
}

const sourceSchema: TestNodeSchema = {
  type: 'Source',
  name: 'Source',
  nodeType: NodeType.Entry,
  handles: [{ key: 'out', position: HandlePosition.Right, accepts: 'number', name: 'out' }],
}

const passSchema: TestNodeSchema = {
  type: 'Pass',
  name: 'Pass',
  handles: [
    { key: 'in', position: HandlePosition.Left, accepts: 'number', name: 'in' },
    { key: 'out', position: HandlePosition.Right, accepts: 'number', name: 'out' },
  ],
}

const sinkSchema: TestNodeSchema = {
  type: 'Sink',
  name: 'Sink',
  handles: [{ key: 'in', position: HandlePosition.Left, accepts: 'number', name: 'in' }],
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

    const minYA = Math.min(positions.get(srcA.id)!.y, positions.get(sinkA.id)!.y)
    const maxYA = Math.max(positions.get(srcA.id)!.y, positions.get(sinkA.id)!.y) + 50
    const yB = positions.get(srcB.id)!.y

    // Components stack top→bottom; the isolated node lands below the
    // connected batch (footprint includes extents, not just origins).
    expect(yB).toBeGreaterThan(maxYA)
    expect(yB - maxYA).toBeGreaterThanOrEqual(80)
    expect(minYA).toBeGreaterThanOrEqual(0)
  })

  it('stacks isolated (unconnected) nodes top-to-bottom', () => {
    const ws = makeWorkspace()
    const n1 = ws.addNode(sourceSchema.type)
    const n2 = ws.addNode(sourceSchema.type)
    const n3 = ws.addNode(sourceSchema.type)

    const { positions } = computeNodePositions(ws.nodes, ws.edges, {
      measure,
      componentGap: 80,
    })

    const xs = [n1, n2, n3].map((n) => positions.get(n.id)!.x)
    const ys = [n1, n2, n3].map((n) => positions.get(n.id)!.y).sort((a, b) => a - b)
    // All isolated nodes share the same column x.
    expect(xs[0]).toBe(xs[1])
    expect(xs[1]).toBe(xs[2])
    // Each node is 50 tall; consecutive isolated nodes are separated by more
    // than a node's height (footprint includes extents, not just origins).
    expect(ys[1]!).toBeGreaterThanOrEqual(ys[0]! + 50 + 80)
    expect(ys[2]!).toBeGreaterThanOrEqual(ys[1]! + 50 + 80)
  })

  it('treats a self-loop node as isolated (no edges to other nodes)', () => {
    const ws = makeWorkspace()
    const loop = ws.addNode(passSchema.type)
    const lone = ws.addNode(sourceSchema.type)
    rawConnect(ws, loop.getHandle('out')!, loop.getHandle('in')!)

    const { positions } = computeNodePositions(ws.nodes, ws.edges, {
      measure,
      componentGap: 80,
    })

    const pLoop = positions.get(loop.id)!
    const pLone = positions.get(lone.id)!
    // A node whose only edge is to itself is not connected to other nodes, so
    // it joins the isolated column (same x) stacked top→bottom.
    expect(pLoop.x).toBe(pLone.x)
    expect(pLone.y).toBeGreaterThan(pLoop.y)
  })

  it('stacks a connected batch above isolated nodes in the same column', () => {
    const ws = makeWorkspace()
    const srcA = ws.addNode(sourceSchema.type)
    const sinkA = ws.addNode(sinkSchema.type)
    ws.connect(srcA.getHandle('out')!, sinkA.getHandle('in')!)
    const iso1 = ws.addNode(sourceSchema.type)
    const iso2 = ws.addNode(sourceSchema.type)

    const { positions } = computeNodePositions(ws.nodes, ws.edges, {
      measure,
      componentGap: 80,
    })

    const maxYConnected =
      Math.max(positions.get(srcA.id)!.y, positions.get(sinkA.id)!.y) + 50
    const pIso1 = positions.get(iso1.id)!
    const pIso2 = positions.get(iso2.id)!

    // The connected batch flows left→right internally, then isolated nodes
    // stack below it sharing the same column x.
    expect(positions.get(sinkA.id)!.x).toBeGreaterThan(positions.get(srcA.id)!.x)
    expect(pIso1.y).toBeGreaterThan(maxYConnected)
    expect(pIso1.x).toBe(pIso2.x)
    expect(pIso2.y).toBeGreaterThan(pIso1.y)
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

  it('arranges the inner workspace of a freshly created subgraph', () => {
    const ws = makeWorkspace()
    const src = ws.addNode(sourceSchema.type)
    const pass = ws.addNode(passSchema.type)
    const sink = ws.addNode(sinkSchema.type)
    ws.connect(src.getHandle('out')!, pass.getHandle('in')!)
    ws.connect(pass.getHandle('out')!, sink.getHandle('in')!)
    pass.moveTo(200, 300)

    // Group just the middle node → convert to a subgraph.
    const group = new Group()
    group.id = ws.nextId()
    group.setWorkspace(ws)
    group.nodes.push(pass.id)
    ws._groups.push(group)
    ws.convertGroupToSubGraph(group.id)

    const subGraph = ws.subGraphs[0]!
    autoLayout(subGraph.workspace, { measure })

    const inner = subGraph.workspace
    const inputs = inner.nodes.filter((n) => n.type === 'subgraph.input')
    const outputs = inner.nodes.filter((n) => n.type === 'subgraph.output')
    const innerPass = inner.nodes.find((n) => n.type === passSchema.type)!

    // Inside the subgraph the internal node is placed between its input and
    // output interface nodes (inputs left, outputs right).
    const maxInputX = Math.max(...inputs.map((n) => n.pos.x))
    const passX = innerPass.pos.x
    const minOutputX = Math.min(...outputs.map((n) => n.pos.x))

    expect(inputs.length).toBeGreaterThan(0)
    expect(outputs.length).toBeGreaterThan(0)
    expect(passX).toBeGreaterThan(maxInputX)
    expect(minOutputX).toBeGreaterThan(passX)
  })
})