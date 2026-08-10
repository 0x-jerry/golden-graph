import { describe, expect, it } from 'vitest'
import { Group, HandlePosition, Workspace } from '@0x-jerry/golden-graph'
import { buildDefaultContextMenu } from '../../src/renderer'
import { collectAddableNodes } from '../../src/renderer'
import { ContextMenuTargetType } from '../../src/renderer/types'

function createWorkspaceWithProviders() {
  const ws = new Workspace()

  ws.registerNodeProvider({
    id: '',
    name: 'Base',
    nodes: {
      Number: {
        name: 'Number',
        handles: [
          { key: 'out', position: HandlePosition.Right, accepts: 'number' },
        ],
      },
    },
  })

  ws.registerNodeProvider({
    id: 'Math',
    name: 'Math',
    nodes: {
      Op: {
        name: 'Math - Op',
        handles: [
          { key: 'a', position: HandlePosition.Left, accepts: 'number' },
          { key: 'out', position: HandlePosition.Right, accepts: 'number' },
        ],
      },
    },
  })

  return ws
}

function addNodeItem(ws: Workspace) {
  const menus = buildDefaultContextMenu(
    { type: ContextMenuTargetType.Canvas },
    ws,
  )
  return menus.find((item) => item.label === 'Add Node')!
}

describe('ContextMenuBuilder (Add Node)', () => {
  it('renders a flat Add Node item that opens the picker dialog', () => {
    const ws = createWorkspaceWithProviders()
    const addNode = addNodeItem(ws)

    expect(addNode.key).toBe('add-node')
    expect(addNode.children).toBeUndefined()
  })
})

describe('collectAddableNodes', () => {
  it('groups nodes into providers by provider name', () => {
    const ws = createWorkspaceWithProviders()
    const groups = collectAddableNodes(ws)

    expect(groups.map((g) => g.providerName)).toEqual(['Base', 'Math'])
    expect(groups[0]!.nodes.map((n) => n.name)).toEqual(['Number'])
    expect(groups[1]!.nodes.map((n) => n.name)).toEqual(['Math - Op'])
    expect(groups[1]!.nodes[0]!.type).toBe('Math.Op')
  })

  it('hides the internal subgraph provider (no visible nodes)', () => {
    const ws = createWorkspaceWithProviders()
    const groups = collectAddableNodes(ws)

    expect(groups.map((g) => g.providerName)).not.toContain('SubGraph')
  })

  it('exposes the subgraph interface nodes inside a subgraph', () => {
    const ws = createWorkspaceWithProviders()

    const node = ws.addNode('Number')
    const group = new Group()
    group.id = ws.nextId()
    group.setWorkspace(ws)
    group.nodes.push(node.id)
    ws._groups.push(group)
    ws.convertGroupToSubGraph(group.id)

    const subGraph = ws.subGraphs[0]!
    ws.enterSubGraph(subGraph.id)
    expect(ws.isActiveSubGraph).toBe(true)

    // The name node is auto-created on conversion, so it is not listed again.
    const subGraphGroup = collectAddableNodes(ws).find(
      (g) => g.providerName === 'SubGraph',
    )
    expect(subGraphGroup?.nodes.map((n) => n.name)).toEqual([
      'Input Handle',
      'Output Handle',
    ])
    expect(subGraphGroup?.nodes.map((n) => n.type)).toEqual([
      'subgraph.input',
      'subgraph.output',
    ])

    ws.exitSubGraph()

    // Outside the subgraph the interface provider stays hidden.
    expect(collectAddableNodes(ws).map((g) => g.providerName)).not.toContain(
      'SubGraph',
    )
  })

  it('lists the name node again once it is deleted', () => {
    const ws = createWorkspaceWithProviders()

    const node = ws.addNode('Number')
    const group = new Group()
    group.id = ws.nextId()
    group.setWorkspace(ws)
    group.nodes.push(node.id)
    ws._groups.push(group)
    ws.convertGroupToSubGraph(group.id)

    ws.enterSubGraph(ws.subGraphs[0]!.id)

    const nameNode = ws.nodes.find((n) => n.type === 'subgraph.name')!
    ws.removeNodeByIds(nameNode.id)

    const subGraphGroup = collectAddableNodes(ws).find(
      (g) => g.providerName === 'SubGraph',
    )
    expect(subGraphGroup?.nodes.map((n) => n.name)).toEqual([
      'Input Handle',
      'Output Handle',
      'Graph Name',
    ])
  })

  it('provides a type that adds a node of the derived type', () => {
    const ws = createWorkspaceWithProviders()
    const mathOp = collectAddableNodes(ws).find(
      (g) => g.providerName === 'Math',
    )!.nodes[0]!

    ws.addNode(mathOp.type)

    const nodes = ws.nodes
    expect(nodes.length).toBe(1)
    expect(nodes[0]!.type).toBe('Math.Op')
  })
})
