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
  it('groups nodes into providers and exposes the derived type for adding', () => {
    const ws = createWorkspaceWithProviders()
    const groups = collectAddableNodes(ws)

    expect(groups.map((g) => g.providerName)).toEqual(['Base', 'Math'])
    expect(groups[0]!.nodes.map((n) => n.name)).toEqual(['Number'])
    expect(groups[1]!.nodes.map((n) => n.name)).toEqual(['Math - Op'])
    expect(groups[1]!.nodes[0]!.type).toBe('Math.Op')

    const mathOp = groups.find((g) => g.providerName === 'Math')!.nodes[0]!
    ws.addNode(mathOp.type)

    expect(ws.nodes.length).toBe(1)
    expect(ws.nodes[0]!.type).toBe('Math.Op')
  })

  it('hides the internal subgraph provider and the sub-graph group when empty', () => {
    const ws = createWorkspaceWithProviders()
    const groups = collectAddableNodes(ws)

    expect(groups.map((g) => g.providerName)).not.toContain('SubGraph')
    expect(groups.some((g) => g.providerId === '__subgraph__')).toBe(false)
  })

  it('lists the subgraph interface inside, including a deleted name node', () => {
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

    // Once deleted, the name node is listed again.
    const nameNode = ws.nodes.find((n) => n.type === 'subgraph.name')!
    ws.removeNodeByIds(nameNode.id)
    expect(
      collectAddableNodes(ws)
        .find((g) => g.providerId === 'subgraph')
        ?.nodes.map((n) => n.name),
    ).toEqual(['Input Handle', 'Output Handle', 'Graph Node Info'])

    ws.exitSubGraph()
    // Outside the subgraph the interface provider stays hidden.
    expect(
      collectAddableNodes(ws).some((g) => g.providerId === 'subgraph'),
    ).toBe(false)
  })

  it('lists existing subgraphs as addable sub-graph nodes, but not while inside one', () => {
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

    ws.enterSubGraph(subGraph.id)
    expect(ws.isActiveSubGraph).toBe(true)
    expect(
      collectAddableNodes(ws).some((g) => g.providerId === '__subgraph__'),
    ).toBe(false)
  })

  it('adds a SubGraphNode, keeping the name in sync when the name node is missing', () => {
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

    // Without a name node, the option falls back to the id-based name.
    const ws2 = createWorkspaceWithProviders()
    const subGraph2 = addSubGraph(ws2)
    const nameNode = subGraph2.workspace.nodes.find(
      (n) => n.type === 'subgraph.name',
    )
    subGraph2.workspace.removeNodeByIds(nameNode!.id)

    const option2 = collectAddableNodes(ws2).find(
      (g) => g.providerName === 'Sub Graph',
    )!.nodes[0]!
    expect(option2.name).toBe(`SubGraph #${subGraph2.id}`)

    const added2 = addNodeFromOption(ws2, option2)
    expect(added2.name).toBe(`SubGraph #${subGraph2.id}`)
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
