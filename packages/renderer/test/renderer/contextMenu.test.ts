import { describe, it, expect } from 'vitest'
import {
  Group,
  HandlePosition,
  SubGraphNode,
  Workspace,
  type INodeSchema,
} from '@0x-jerry/golden-graph'
import { buildDefaultContextMenu } from '../../src/renderer/ContextMenuBuilder'
import { ContextMenuTargetType } from '../../src/renderer/types'

const numberSchema: INodeSchema = {
  type: 'Number',
  name: 'Number',
  handles: [
    {
      key: 'value',
      name: 'Value',
      type: 'number',
      position: HandlePosition.Right,
      value: 1,
    },
  ],
}

const sumSchema: INodeSchema = {
  type: 'Sum',
  name: 'Sum',
  handles: [
    { key: 'a', name: 'A', type: 'number', position: HandlePosition.Left },
    { key: 'b', name: 'B', type: 'number', position: HandlePosition.Left },
    { key: 'out', name: 'Out', type: 'number', position: HandlePosition.Right },
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

describe('buildDefaultContextMenu', () => {
  it('adds an Enter SubGraph item for subgraph nodes', () => {
    const ws = createWs()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    ws.connect(a.getHandle('value')!, b.getHandle('a')!)

    const group = groupNodes(ws, a.id, b.id)
    ws.convertGroupToSubGraph(group.id)

    const subGraphNode = ws.nodes.find((n) => n.subGraphId)!
    const subGraph = ws.subGraphs.find((s) => s.id === subGraphNode.subGraphId)!
    const internalEdgeCount = subGraph.workspace.edges.length
    expect(subGraphNode.subGraphId).toBe(subGraph.id)

    const items = buildDefaultContextMenu(
      { type: ContextMenuTargetType.Node, id: subGraphNode.id },
      ws,
    )

    expect(items[0]!.label).toBe('Enter SubGraph')

    items[0]!.action!()
    expect(ws.isActiveSubGraph).toBe(true)

    // entering swaps in the subgraph's internal workspace — the edge between
    // a and b is now the one inside the subgraph
    expect(ws.edges.length).toBe(internalEdgeCount)
    expect(ws.edges.length).toBe(1)

    ws.exitSubGraph()
    expect(ws.isActiveSubGraph).toBe(false)
  })

  it('does not add an Enter SubGraph item for regular nodes', () => {
    const ws = createWs()
    const a = ws.addNode('Number')

    const items = buildDefaultContextMenu(
      { type: ContextMenuTargetType.Node, id: a.id },
      ws,
    )

    expect(items.some((item) => item.label === 'Enter SubGraph')).toBe(false)
  })

  it('adds an Exit SubGraph item on the canvas while inside a subgraph', () => {
    const ws = createWs()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    ws.connect(a.getHandle('value')!, b.getHandle('a')!)

    const group = groupNodes(ws, a.id, b.id)
    ws.convertGroupToSubGraph(group.id)

    const subGraphNode = ws.nodes.find((n) => n.subGraphId)!
    ws.enterSubGraph(subGraphNode.subGraphId!)

    const items = buildDefaultContextMenu(
      { type: ContextMenuTargetType.Canvas },
      ws,
    )

    expect(items[0]!.label).toBe('Exit SubGraph')
    items[0]!.action!()
    expect(ws.isActiveSubGraph).toBe(false)
  })

  it('duplicates a subgraph node by reusing the same sub-graph', () => {
    const ws = createWs()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    ws.connect(a.getHandle('value')!, b.getHandle('a')!)

    const group = groupNodes(ws, a.id, b.id)
    ws.convertGroupToSubGraph(group.id)

    const subGraph = ws.subGraphs[0]!
    const original = ws.nodes.find((n) => n.subGraphId)!

    const items = buildDefaultContextMenu(
      { type: ContextMenuTargetType.Node, id: original.id },
      ws,
    )
    const dup = items.find((item) => item.label === 'Duplicate')!
    dup.action!()

    const copies = ws.nodes.filter((n) => n.subGraphId === subGraph.id)
    expect(copies).toHaveLength(2)
    for (const n of copies) {
      expect((n as SubGraphNode).subGraph).toBe(subGraph)
    }
  })
})
