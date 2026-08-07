import { describe, expect, it } from 'vitest'
import {
  Group,
  HandlePosition,
  Workspace,
  isSubGraphNameNode,
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

describe('convertGroupToSubGraph', () => {
  it('keeps internal edges connected so data keeps flowing', () => {
    const ws = createWs()
    const n1 = ws.addNode('Number')
    const n2 = ws.addNode('Number')
    const sum = ws.addNode('Sum')

    ws.connect(n1.getHandle('value')!, sum.getHandle('a')!)
    ws.connect(n2.getHandle('value')!, sum.getHandle('b')!)

    // sanity: before conversion, values propagate
    expect(sum.getData('a')).toBe(1)

    const group = groupNodes(ws, n1.id, n2.id, sum.id)
    ws.convertGroupToSubGraph(group.id)

    const subGraph = ws.subGraphs[0]!
    const innerSum = subGraph.workspace.nodes.find((n) => n.name === 'Sum')!

    // internal edges must still drive data flow
    expect(innerSum.getData('a')).toBe(1)
    expect(innerSum.getData('b')).toBe(1)

    const handleA = innerSum.getHandle('a')!
    expect(handleA.isConnected).toBe(true)

    // edge index inside the subgraph workspace must be consistent
    const n1Handle = n1.getHandle('value')!
    expect(subGraph.workspace.queryEdges(n1Handle.loc).length).toBe(1)
  })

  it('round-trips through toJSON/fromJSON with connections intact', () => {
    const ws = createWs()
    const n1 = ws.addNode('Number')
    const sum = ws.addNode('Sum')
    ws.connect(n1.getHandle('value')!, sum.getHandle('a')!)

    const group = groupNodes(ws, n1.id, sum.id)
    ws.convertGroupToSubGraph(group.id)

    const ws2 = createWs()
    ws2.fromJSON(ws.toJSON())

    const subGraph = ws2.subGraphs[0]!
    const innerSum = subGraph.workspace.nodes.find((n) => n.name === 'Sum')!
    expect(innerSum.getData('a')).toBe(1)
    expect(innerSum.getHandle('a')!.isConnected).toBe(true)
  })
})

describe('enterSubGraph/exitSubGraph', () => {
  it('enters and exits a subgraph without extra node registration', () => {
    const ws = createWs()
    const extIn = ws.addNode('Number')
    const extOut = ws.addNode('Sum')
    const n1 = ws.addNode('Number')
    const sum = ws.addNode('Sum')

    // external input: extIn -> sum.a, internal: n1 -> sum.b,
    // external output: sum.out -> extOut.a
    ws.connect(extIn.getHandle('value')!, sum.getHandle('a')!)
    ws.connect(n1.getHandle('value')!, sum.getHandle('b')!)
    ws.connect(sum.getHandle('out')!, extOut.getHandle('a')!)

    const group = groupNodes(ws, n1.id, sum.id)
    ws.convertGroupToSubGraph(group.id)

    const subGraph = ws.subGraphs[0]!
    const subGraphNode = ws.nodes.find((n) => isSubGraphNode(n) && n.subGraphId === subGraph.id)!
    expect(subGraphNode.handles.length).toBe(2)

    // subgraph.input/output are internal types — entering must not require
    // the consumer to register them on the main workspace.
    ws.enterSubGraph(subGraph.id)
    expect(ws.isActiveSubGraph).toBe(true)
    expect(ws.nodes.some((n) => n.type === 'subgraph.input')).toBe(true)
    expect(ws.nodes.some((n) => n.type === 'subgraph.output')).toBe(true)

    ws.exitSubGraph()
    expect(ws.isActiveSubGraph).toBe(false)

    // the subgraph node is rebuilt with the same interface
    const rebuilt = ws.nodes.find((n) => isSubGraphNode(n) && n.subGraphId === subGraph.id)!
    expect(rebuilt).toBeDefined()
    expect(rebuilt.handles.length).toBe(subGraphNode.handles.length)

    // external connections are restored on the rebuilt node
    expect(ws.queryEdges(extIn.getHandle('value')!.loc).length).toBe(1)
    expect(ws.queryEdges(extOut.getHandle('a')!.loc).length).toBe(1)
  })

  it('keeps external connections after renaming input/output handles', () => {
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

    const subGraph = ws.subGraphs[0]!
    const subGraphId = subGraph.id
    const oldSubGraphNode = ws.nodes.find((n) => isSubGraphNode(n) && n.subGraphId === subGraphId)!
    const oldKeys = oldSubGraphNode.handles.map((h) => h.key)

    ws.enterSubGraph(subGraphId)

    // rename the interface nodes inside the subgraph
    const inputNode = ws.nodes.find((n) => n.type === 'subgraph.input')!
    const outputNode = ws.nodes.find((n) => n.type === 'subgraph.output')!
    inputNode.setData('Name', 'RenamedIn')
    outputNode.setData('Name', 'RenamedOut')

    ws.exitSubGraph()
    expect(ws.isActiveSubGraph).toBe(false)

    // collapsed handle keys are the interface node ids — stable across
    // renames; only the display labels change
    const rebuilt = ws.nodes.find((n) => isSubGraphNode(n) && n.subGraphId === subGraphId)!
    expect(rebuilt.handles.map((h) => h.key).sort()).toEqual(
      [...oldKeys].sort(),
    )
    expect(rebuilt.handles.map((h) => h.name)).toContain('RenamedIn')
    expect(rebuilt.handles.map((h) => h.name)).toContain('RenamedOut')

    // external connections are restored on the rebuilt node
    expect(ws.queryEdges(extIn.getHandle('value')!.loc).length).toBe(1)
    expect(ws.queryEdges(extOut.getHandle('a')!.loc).length).toBe(1)
  })
})

describe('subgraph name node', () => {
  it('creates a subgraph.name node seeded with the group name', () => {
    const ws = createWs()
    const n1 = ws.addNode('Number')

    const group = groupNodes(ws, n1.id)
    group.setName('My Group')
    ws.convertGroupToSubGraph(group.id)

    const subGraph = ws.subGraphs[0]!
    const nameNode = subGraph.workspace.nodes.find(isSubGraphNameNode)!
    expect(nameNode).toBeDefined()
    expect(nameNode.getData('Name')).toBe('My Group')
  })

  it('renames the parent SubGraphNode when the name node changes inside', () => {
    const ws = createWs()
    const n1 = ws.addNode('Number')

    const group = groupNodes(ws, n1.id)
    group.setName('My Group')
    ws.convertGroupToSubGraph(group.id)

    const subGraph = ws.subGraphs[0]!
    const subGraphNode = ws.nodes.find(
      (n) => isSubGraphNode(n) && n.subGraphId === subGraph.id,
    )!
    expect(subGraphNode.name).toBe('My Group')

    ws.enterSubGraph(subGraph.id)

    const nameNode = ws.nodes.find(isSubGraphNameNode)!
    nameNode.setData('Name', 'Renamed')

    ws.exitSubGraph()

    const rebuilt = ws.nodes.find(
      (n) => isSubGraphNode(n) && n.subGraphId === subGraph.id,
    )!
    expect(rebuilt.name).toBe('Renamed')
  })

  it('keeps the subgraph name across JSON round-trips', () => {
    const ws = createWs()
    const n1 = ws.addNode('Number')

    const group = groupNodes(ws, n1.id)
    group.setName('My Group')
    ws.convertGroupToSubGraph(group.id)

    const ws2 = createWs()
    ws2.fromJSON(ws.toJSON())

    const subGraph = ws2.subGraphs[0]!
    const subGraphNode = ws2.nodes.find(
      (n) => isSubGraphNode(n) && n.subGraphId === subGraph.id,
    )!
    const nameNode = subGraph.workspace.nodes.find(isSubGraphNameNode)!

    expect(nameNode.getData('Name')).toBe('My Group')
    expect(subGraphNode.name).toBe('My Group')
  })
})
