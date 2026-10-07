import { describe, it, expect } from 'vitest'
import {
  Edge,
  Group,
  HandlePosition,
  NodeType,
  Workspace,
  type NodeHandle,
} from '@0x-jerry/golden-graph'
import {
  autoLayout,
  boundingRect,
  computeNodePositions,
  estimateSize,
  resolveEdgeDirection,
  resolveLayoutOptions,
} from '../../src/layout'
import type { LayoutOptions } from '../../src/layout'

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
  handles: [
    {
      key: 'out',
      position: HandlePosition.Right,
      accepts: 'number',
      name: 'out',
    },
  ],
}

const passSchema: TestNodeSchema = {
  type: 'Pass',
  name: 'Pass',
  handles: [
    { key: 'in', position: HandlePosition.Left, accepts: 'number', name: 'in' },
    {
      key: 'out',
      position: HandlePosition.Right,
      accepts: 'number',
      name: 'out',
    },
  ],
}

const sinkSchema: TestNodeSchema = {
  type: 'Sink',
  name: 'Sink',
  handles: [
    { key: 'in', position: HandlePosition.Left, accepts: 'number', name: 'in' },
  ],
}

const biOutSchema: TestNodeSchema = {
  type: 'BiOut',
  name: 'BiOut',
  handles: [
    {
      key: 'outTop',
      position: HandlePosition.Right,
      accepts: 'number',
      name: 'outTop',
    },
    {
      key: 'outBottom',
      position: HandlePosition.Right,
      accepts: 'number',
      name: 'outBottom',
    },
  ],
}

const biInSchema: TestNodeSchema = {
  type: 'BiIn',
  name: 'BiIn',
  handles: [
    {
      key: 'inTop',
      position: HandlePosition.Left,
      accepts: 'number',
      name: 'inTop',
    },
    {
      key: 'inBottom',
      position: HandlePosition.Left,
      accepts: 'number',
      name: 'inBottom',
    },
  ],
}

function makeWorkspace() {
  const ws = new Workspace()
  ws.registerNodeSchema(sourceSchema)
  ws.registerNodeSchema(passSchema)
  ws.registerNodeSchema(sinkSchema)
  ws.registerNodeSchema(biOutSchema)
  ws.registerNodeSchema(biInSchema)
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
  it('resolves producer→consumer regardless of start/end order', () => {
    const { ws, nodes } = chain([sourceSchema, sinkSchema])
    const edge = ws.queryConnectedEdges(at(nodes, 0).id)[0]!
    expect(resolveEdgeDirection(edge)).toEqual([
      at(nodes, 0).id,
      at(nodes, 1).id,
    ])

    const ws2 = makeWorkspace()
    const a = ws2.addNode(sourceSchema.type)
    const b = ws2.addNode(sinkSchema.type)
    ws2.connect(a.getHandle('out')!, b.getHandle('in')!)
    const reversed = ws2.queryConnectedEdges(a.id)[0]!
    // start/end order is unreliable, but direction must come from positions.
    expect(resolveEdgeDirection(reversed)).toEqual([a.id, b.id])
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
  it('lays a linear chain in increasing rank and keeps same-side edges in one rank', () => {
    const { ws, nodes } = chain([sourceSchema, passSchema, sinkSchema])
    const { positions } = computeNodePositions(ws.nodes, ws.edges, { measure })

    const p0 = positions.get(at(nodes, 0).id)!
    const p1 = positions.get(at(nodes, 1).id)!
    const p2 = positions.get(at(nodes, 2).id)!

    expect(p1.x).toBeGreaterThan(p0.x)
    expect(p2.x).toBeGreaterThan(p1.x)
    expect(p1.y).toBe(p0.y)
    expect(p2.y).toBe(p1.y)

    // a same-side edge cannot imply direction, so both nodes share a rank
    const ws2 = makeWorkspace()
    const a = ws2.addNode(passSchema.type)
    const b = ws2.addNode(passSchema.type)
    rawConnect(ws2, a.getHandle('out')!, b.getHandle('out')!)
    const same = computeNodePositions(ws2.nodes, ws2.edges, { measure })
    expect(same.positions.get(a.id)!.x).toBe(same.positions.get(b.id)!.x)
  })

  it('stacks fan-out consumers vertically without overlaps', () => {
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

    // adding more consumers keeps every same-rank pair non-overlapping
    const ws2 = makeWorkspace()
    const src2 = ws2.addNode(sourceSchema.type)
    for (let i = 0; i < 6; i++) {
      const s = ws2.addNode(sinkSchema.type)
      ws2.connect(src2.getHandle('out')!, s.getHandle('in')!)
    }
    const spread = computeNodePositions(ws2.nodes, ws2.edges, { measure })
    const sameRank = Array.from(spread.positions.values())
      .filter((p) => p.x === spread.positions.get(src2.id)!.x)
      .map((p) => p.y)
      .sort((a, b) => a - b)
    for (let i = 1; i < sameRank.length; i++) {
      expect(sameRank[i]! - sameRank[i - 1]!).toBeGreaterThanOrEqual(50)
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

  it('stacks components and isolated nodes top-to-bottom with componentGap', () => {
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
    const maxYA =
      Math.max(positions.get(srcA.id)!.y, positions.get(sinkA.id)!.y) + 50
    const yB = positions.get(srcB.id)!.y

    // Components stack top→bottom; the isolated node lands below the
    // connected batch (footprint includes extents, not just origins).
    expect(yB).toBeGreaterThan(maxYA)
    expect(yB - maxYA).toBeGreaterThanOrEqual(80)
    expect(minYA).toBeGreaterThanOrEqual(0)

    // several isolated nodes share a column, stacked with the gap
    const iso = makeWorkspace()
    const n1 = iso.addNode(sourceSchema.type)
    const n2 = iso.addNode(sourceSchema.type)
    const n3 = iso.addNode(sourceSchema.type)
    const isoPos = computeNodePositions(iso.nodes, iso.edges, {
      measure,
      componentGap: 80,
    }).positions

    const xs = [n1, n2, n3].map((n) => isoPos.get(n.id)!.x)
    const ys = [n1, n2, n3]
      .map((n) => isoPos.get(n.id)!.y)
      .sort((a, b) => a - b)
    expect(xs[0]).toBe(xs[1])
    expect(xs[1]).toBe(xs[2])
    expect(ys[1]!).toBeGreaterThanOrEqual(ys[0]! + 50 + 80)
    expect(ys[2]!).toBeGreaterThanOrEqual(ys[1]! + 50 + 80)

    // a self-loop is not a connection to another node — it joins the isolated
    const loop = makeWorkspace()
    const loopNode = loop.addNode(passSchema.type)
    const lone = loop.addNode(sourceSchema.type)
    rawConnect(loop, loopNode.getHandle('out')!, loopNode.getHandle('in')!)
    const loopPos = computeNodePositions(loop.nodes, loop.edges, {
      measure,
      componentGap: 80,
    }).positions
    expect(loopPos.get(loopNode.id)!.x).toBe(loopPos.get(lone.id)!.x)
    expect(loopPos.get(lone.id)!.y).toBeGreaterThan(
      loopPos.get(loopNode.id)!.y,
    )

    // a connected batch stacks above isolated nodes in the same column
    const mixed = makeWorkspace()
    const mSrc = mixed.addNode(sourceSchema.type)
    const mSink = mixed.addNode(sinkSchema.type)
    mixed.connect(mSrc.getHandle('out')!, mSink.getHandle('in')!)
    const iso1 = mixed.addNode(sourceSchema.type)
    const iso2 = mixed.addNode(sourceSchema.type)
    const mixedPos = computeNodePositions(mixed.nodes, mixed.edges, {
      measure,
      componentGap: 80,
    }).positions

    const maxYConnected =
      Math.max(mixedPos.get(mSrc.id)!.y, mixedPos.get(mSink.id)!.y) + 50
    expect(mixedPos.get(mSink.id)!.x).toBeGreaterThan(mixedPos.get(mSrc.id)!.x)
    expect(mixedPos.get(iso1.id)!.y).toBeGreaterThan(maxYConnected)
    expect(mixedPos.get(iso1.id)!.x).toBe(mixedPos.get(iso2.id)!.x)
    expect(mixedPos.get(iso2.id)!.y).toBeGreaterThan(mixedPos.get(iso1.id)!.y)
  })
})

describe('computeNodePositions handle alignment', () => {
  // Stub handle rows: 10px below the header plus 30px per handle index, so
  // passSchema's `out` (index 1) sits 40px down and every `in` (index 0) 10px.
  const getHandleY = (
    node: { handles: ReadonlyArray<{ key: string }> },
    handle: { key: string },
  ) => node.handles.findIndex((h) => h.key === handle.key) * 30 + 10

  it('aligns the connected handle joints vertically', () => {
    const ws = makeWorkspace()
    const pass = ws.addNode(passSchema.type)
    const sink = ws.addNode(sinkSchema.type)
    ws.connect(pass.getHandle('out')!, sink.getHandle('in')!)

    const { positions } = computeNodePositions(ws.nodes, ws.edges, {
      measure,
      getHandleY,
    })

    const pPass = positions.get(pass.id)!
    const pSink = positions.get(sink.id)!
    // out row at 40, in row at 10 → the sink is shifted down 30.
    expect(pSink.y - pPass.y).toBeCloseTo(30)
    expect(pPass.y + 40).toBeCloseTo(pSink.y + 10)
  })

  it('separates fan-out consumers that would collapse onto the same row', () => {
    const ws = makeWorkspace()
    const src = ws.addNode(sourceSchema.type)
    const c1 = ws.addNode(sinkSchema.type)
    const c2 = ws.addNode(sinkSchema.type)
    ws.connect(src.getHandle('out')!, c1.getHandle('in')!)
    ws.connect(src.getHandle('out')!, c2.getHandle('in')!)

    const { positions } = computeNodePositions(ws.nodes, ws.edges, {
      measure,
      getHandleY,
      yGap: 40,
    })

    const ps = positions.get(src.id)!
    const p1 = positions.get(c1.id)!
    const p2 = positions.get(c2.id)!
    // Both consumers prefer the source's out row; the top one keeps it…
    const top = Math.min(p1.y, p2.y)
    const bottom = Math.max(p1.y, p2.y)
    expect(ps.y + 10).toBeCloseTo(top + 10)
    // …and the second is pushed below it without overlapping.
    expect(bottom).toBeGreaterThanOrEqual(top + 50 + 40 - 0.001)
  })

  it('orders consumers/producers by their connected handle row', () => {
    const wsOut = makeWorkspace()
    const src = wsOut.addNode(biOutSchema.type)
    const topCon = wsOut.addNode(sinkSchema.type)
    const bottomCon = wsOut.addNode(sinkSchema.type)
    wsOut.connect(src.getHandle('outTop')!, topCon.getHandle('in')!)
    wsOut.connect(src.getHandle('outBottom')!, bottomCon.getHandle('in')!)

    const outPos = computeNodePositions(wsOut.nodes, wsOut.edges, {
      measure,
      getHandleY,
      yGap: 40,
    }).positions

    // outTop (row 10) is above outBottom (row 40), so the consumer attached
    // to the top handle must sit above the bottom-handle consumer, and its
    // in joint still aligns with the top out joint.
    expect(outPos.get(topCon.id)!.y).toBeLessThan(outPos.get(bottomCon.id)!.y)
    expect(outPos.get(src.id)!.y + 10).toBeCloseTo(
      outPos.get(topCon.id)!.y + 10,
    )

    const wsIn = makeWorkspace()
    const topSrc = wsIn.addNode(sourceSchema.type)
    const bottomSrc = wsIn.addNode(sourceSchema.type)
    const sink = wsIn.addNode(biInSchema.type)
    wsIn.connect(topSrc.getHandle('out')!, sink.getHandle('inTop')!)
    wsIn.connect(bottomSrc.getHandle('out')!, sink.getHandle('inBottom')!)

    const inPos = computeNodePositions(wsIn.nodes, wsIn.edges, {
      measure,
      getHandleY,
      yGap: 40,
    }).positions

    // inTop (row 10) is above inBottom (row 40), so the producer feeding the
    // top input must sit above the one feeding the bottom input.
    expect(inPos.get(topSrc.id)!.y).toBeLessThan(inPos.get(bottomSrc.id)!.y)
  })
})

describe('autoLayout', () => {
  it('applies positions, and is a no-op while the workspace is disabled', () => {
    const first = chain([sourceSchema, passSchema, sinkSchema])
    first.ws.nodes.forEach((n) => n.moveTo(0, 0))
    autoLayout(first.ws, { measure })

    const p0 = at(first.nodes, 0).pos
    const p1 = at(first.nodes, 1).pos
    const p2 = at(first.nodes, 2).pos
    // Ranks flow left → right: downstream nodes move along the main axis.
    expect(p0.x).toBe(0)
    expect(p1.x).toBeGreaterThan(p0.x)
    expect(p2.x).toBeGreaterThan(p1.x)
    expect(p2.y).toBe(p0.y)

    const { ws, nodes } = chain([sourceSchema, passSchema, sinkSchema])
    nodes.forEach((n) => n.moveTo(0, 0))
    const orig = nodes.map((n) => ({ ...n.pos }))
    ws._state.disabled = true
    autoLayout(ws, { measure })
    expect(nodes.map((n) => n.pos)).toEqual(orig)
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

describe('shared helpers', () => {
  it('exposes boundingRect, estimateSize and resolveLayoutOptions', () => {
    expect(boundingRect([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(
      boundingRect([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 5, y: 50, width: 15, height: 10 },
      ]),
    ).toEqual({ x: 5, y: 20, width: 35, height: 40 })

    const node = makeWorkspace().addNode(sourceSchema.type)
    expect(estimateSize(node).width).toBeGreaterThan(0)
    expect(estimateSize(node).height).toBeGreaterThan(0)

    expect(resolveLayoutOptions()).toEqual({
      xGap: 60,
      yGap: 40,
      componentGap: 80,
    })
    expect(resolveLayoutOptions({ xGap: 10 }).xGap).toBe(10)
  })
})
