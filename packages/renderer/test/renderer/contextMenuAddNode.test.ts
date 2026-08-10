import { describe, expect, it } from 'vitest'
import {
  Group,
  HandlePosition,
  Workspace,
  isSubGraphNode,
} from '@0x-jerry/golden-graph'
import { buildDefaultContextMenu } from '../../src/renderer'
import { addNodeFromOption, collectAddableNodes } from '../../src/renderer'
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

function addSubGraph(ws: Workspace) {
  const node = ws.addNode('Number')
  const group = new Group()
  group.id = ws.nextId()
  group.setWorkspace(ws)
  group.nodes.push(node.id)
  ws._groups.push(group)
  ws.convertGroupToSubGraph(group.id)
  return ws.subGraphs[0]!
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
      (g) => g.providerId === 'subgraph',
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
    expect(
      collectAddableNodes(ws).some((g) => g.providerId === 'subgraph'),
    ).toBe(false)
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
      (g) => g.providerId === 'subgraph',
    )
    expect(subGraphGroup?.nodes.map((n) => n.name)).toEqual([
      'Input Handle',
      'Output Handle',
      'Graph Node Info',
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

  it('lists existing subgraphs as addable sub-graph nodes', () => {
    const ws = createWorkspaceWithProviders()
    const subGraph = addSubGraph(ws)

    const nameNode = subGraph.workspace.nodes.find(
      (n) => n.type === 'subgraph.name',
    )
    nameNode?.setData('Description', 'Runs a reusable sub-flow')

    const groups = collectAddableNodes(ws)
    const subGraphGroup = groups.find((g) => g.providerName === 'Sub Graph')

    expect(subGraphGroup?.providerId).toBe('__subgraph__')
    expect(subGraphGroup?.nodes).toEqual([
      {
        type: `subgraph:${subGraph.id}`,
        name: 'Untitled',
        description: 'Runs a reusable sub-flow',
        subGraphId: subGraph.id,
      },
    ])
  })

  it('hides the subgraph group when there are no subgraphs', () => {
    const ws = createWorkspaceWithProviders()

    expect(
      collectAddableNodes(ws).some((g) => g.providerId === '__subgraph__'),
    ).toBe(false)
  })

  it('does not list parent subgraphs while inside a subgraph', () => {
    const ws = createWorkspaceWithProviders()
    addSubGraph(ws)

    ws.enterSubGraph(ws.subGraphs[0]!.id)
    expect(ws.isActiveSubGraph).toBe(true)

    expect(
      collectAddableNodes(ws).some((g) => g.providerId === '__subgraph__'),
    ).toBe(false)
  })

  it('adds a SubGraphNode from a subgraph option', () => {
    const ws = createWorkspaceWithProviders()
    const subGraph = addSubGraph(ws)
    const option = collectAddableNodes(ws).find(
      (g) => g.providerName === 'Sub Graph',
    )!.nodes[0]!

    const added = addNodeFromOption(ws, option, { x: 42, y: 24 })

    if (!isSubGraphNode(added)) {
      throw new Error('Expected a SubGraphNode')
    }

    expect(added.subGraphId).toBe(subGraph.id)
    expect(added.pos).toEqual({ x: 42, y: 24 })
    expect(added.name).toBe(option.name)
    expect(ws.nodes).toContain(added)
  })

  it('keeps the inserted name in sync when the name node is missing', () => {
    const ws = createWorkspaceWithProviders()
    const subGraph = addSubGraph(ws)

    const nameNode = subGraph.workspace.nodes.find(
      (n) => n.type === 'subgraph.name',
    )
    subGraph.workspace.removeNodeByIds(nameNode!.id)

    const option = collectAddableNodes(ws).find(
      (g) => g.providerName === 'Sub Graph',
    )!.nodes[0]!
    expect(option.name).toBe(`SubGraph #${subGraph.id}`)

    const added = addNodeFromOption(ws, option)

    expect(added.name).toBe(`SubGraph #${subGraph.id}`)
  })

  it('adds a normal node from a plain option', () => {
    const ws = createWorkspaceWithProviders()
    const number = collectAddableNodes(ws).find(
      (g) => g.providerName === 'Base',
    )!.nodes[0]!

    const added = addNodeFromOption(ws, number, { x: 1, y: 2 })

    expect(added.type).toBe('Number')
    expect(added.pos).toEqual({ x: 1, y: 2 })
  })
})
