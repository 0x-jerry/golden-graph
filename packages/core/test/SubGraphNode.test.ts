import { describe, expect, it } from 'vitest'
import {
  Group,
  HandlePosition,
  Node,
  SubGraphNode,
  Workspace,
  isSubGraphNode,
  type INodeSchema,
} from '../src'

const numberSchema: INodeSchema = {
  type: 'Number',
  name: 'Number',
  handles: [
    {
      key: 'value',
      name: 'Value',
      accepts: 'number',
      position: HandlePosition.Right,
      value: 1,
    },
  ],
}

const sumSchema: INodeSchema = {
  type: 'Sum',
  name: 'Sum',
  handles: [
    { key: 'a', name: 'A', accepts: 'number', position: HandlePosition.Left },
    { key: 'b', name: 'B', accepts: 'number', position: HandlePosition.Left },
    { key: 'out', name: 'Out', accepts: 'number', position: HandlePosition.Right },
  ],
}

function createWs() {
  const ws = new Workspace()
  ws.registerNodeSchema(numberSchema)
  ws.registerNodeSchema(sumSchema)
  return ws
}

function groupNodes(ws: Workspace, ...ids: number[]) {
  const group = new Group()
  group.id = ws.nextId()
  group.setWorkspace(ws)
  group.nodes.push(...ids)
  ws._groups.push(group)
  return group
}

function makeSubGraph() {
  const ws = createWs()
  const extIn = ws.addNode('Number')
  const extOut = ws.addNode('Sum')
  const n1 = ws.addNode('Number')
  const sum = ws.addNode('Sum')

  ws.connect(extIn.getHandle('value')!, sum.getHandle('a')!)
  ws.connect(n1.getHandle('value')!, sum.getHandle('b')!)
  ws.connect(sum.getHandle('out')!, extOut.getHandle('a')!)

  const group = groupNodes(ws, n1.id, sum.id)
  ws.convertGroupToSubGraph(group.id)

  return { ws, extIn, extOut, subGraph: ws.subGraphs[0]! }
}

describe('SubGraphNode', () => {
  it('is a Node whose subGraphId points at its SubGraph', () => {
    const { ws, subGraph } = makeSubGraph()

    const subGraphNode = ws.nodes.find((n) => isSubGraphNode(n))!
    expect(subGraphNode).toBeInstanceOf(SubGraphNode)
    expect(subGraphNode).toBeInstanceOf(Node)
    expect(subGraphNode.subGraphId).toBe(subGraph.id)
    expect((subGraphNode as SubGraphNode).subGraph).toBe(subGraph)
  })

  it('tracks its relative nodes on the SubGraph', () => {
    const { ws, subGraph } = makeSubGraph()
    const subGraphNode = ws.nodes.find((n) => isSubGraphNode(n))!

    expect(subGraph.nodes).toContain(subGraphNode)
    expect(subGraph.nodes).toHaveLength(1)
  })

  it('does not mark regular nodes as sub-graph nodes', () => {
    const ws = createWs()
    const n = ws.addNode('Number')
    expect(isSubGraphNode(n)).toBe(false)
    expect(n).not.toBeInstanceOf(SubGraphNode)
  })
})

describe('copySubGraphNode', () => {
  it('reuses the same SubGraph (and inner workspace) as the original', () => {
    const { ws, subGraph } = makeSubGraph()
    const original = ws.nodes.find((n) => isSubGraphNode(n))!

    const copy = ws.copySubGraphNode(subGraph.id)

    expect(copy).toBeInstanceOf(SubGraphNode)
    expect(copy).not.toBe(original)
    expect(copy.id).not.toBe(original.id)
    expect(copy.subGraphId).toBe(original.subGraphId)
    expect(copy.subGraph).toBe(subGraph)
    // both nodes are registered in the parent workspace
    expect(ws.nodes.filter((n) => isSubGraphNode(n) && n.subGraphId === subGraph.id)).toHaveLength(2)
    // the SubGraph now tracks both relative nodes
    expect(subGraph.nodes).toHaveLength(2)
  })

  it('positions the copy offset from the source node', () => {
    const { ws, subGraph } = makeSubGraph()
    const original = ws.nodes.find((n) => isSubGraphNode(n))!
    original.moveTo(100, 200)

    const copy = ws.copySubGraphNode(subGraph.id)

    expect(copy.pos).toEqual({ x: 130, y: 230 })
    expect(original.pos).toEqual({ x: 100, y: 200 })
  })

  it('keeps both copies driven by the same inner workspace', () => {
    const { ws, subGraph, extIn, extOut } = makeSubGraph()
    const original = ws.nodes.find((n) => isSubGraphNode(n))!

    const copy = ws.copySubGraphNode(subGraph.id)

    // the copied node exposes the same collapsed interface
    expect(copy.handles.map((h) => h.key).sort()).toEqual(
      original.handles.map((h) => h.key).sort(),
    )

    // entering through the copy navigates to the shared workspace
    ws.enterSubGraph(copy.subGraphId!)
    expect(ws.isActiveSubGraph).toBe(true)
    expect(ws.nodes.some((n) => n.name === 'Sum')).toBe(true)
    ws.exitSubGraph()

    // external connections still exist on both
    expect(ws.queryEdges(extIn.getHandle('value')!.loc).length).toBe(1)
    expect(ws.queryEdges(extOut.getHandle('a')!.loc).length).toBe(1)
  })

  it('round-trips through toJSON/fromJSON', () => {
    const { ws, subGraph } = makeSubGraph()
    ws.copySubGraphNode(subGraph.id)

    const ws2 = createWs()
    ws2.fromJSON(ws.toJSON())

    expect(ws2.subGraphs.length).toBe(1)
    const subGraphNodes = ws2.nodes.filter(
      (n) => isSubGraphNode(n) && n.subGraphId === subGraph.id,
    )
    expect(subGraphNodes.length).toBe(2)
    for (const n of subGraphNodes) {
      expect(n).toBeInstanceOf(SubGraphNode)
    }
    // inner content survives the round-trip
    const innerSum = ws2.subGraphs[0]!.workspace.nodes.find(
      (n) => n.name === 'Sum',
    )!
    expect(innerSum.getHandle('a')!.isConnected).toBe(true)
    expect(innerSum.getHandle('b')!.isConnected).toBe(true)
  })
})
