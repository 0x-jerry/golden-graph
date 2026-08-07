import { describe, expect, it } from 'vitest'
import { Group, HandlePosition, Workspace } from '@0x-jerry/golden-graph'
import { buildDefaultContextMenu } from '../../src/renderer'
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
  it('groups nodes into provider submenus by provider name', () => {
    const ws = createWorkspaceWithProviders()
    const addNode = addNodeItem(ws)

    expect(addNode.children?.map((c) => c.label)).toEqual(['Base', 'Math'])
    expect(addNode.children![0]!.children?.map((c) => c.label)).toEqual([
      'Number',
    ])
    expect(addNode.children![1]!.children?.map((c) => c.label)).toEqual([
      'Math - Op',
    ])
  })

  it('hides the internal subgraph provider (no visible nodes)', () => {
    const ws = createWorkspaceWithProviders()
    const addNode = addNodeItem(ws)

    expect(addNode.children?.map((c) => c.label)).not.toContain('SubGraph')
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
    const subGraphMenu = addNodeItem(ws).children?.find(
      (c) => c.label === 'SubGraph',
    )
    expect(subGraphMenu?.children?.map((c) => c.label)).toEqual([
      'Input Handle',
      'Output Handle',
    ])

    const inputItem = subGraphMenu!.children!.find(
      (c) => c.label === 'Input Handle',
    )!
    inputItem.action?.()
    expect(ws.nodes.some((n) => n.type === 'subgraph.input')).toBe(true)

    ws.exitSubGraph()

    // Outside the subgraph the interface provider stays hidden.
    expect(addNodeItem(ws).children?.map((c) => c.label)).not.toContain(
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

    const subGraphMenu = addNodeItem(ws).children?.find(
      (c) => c.label === 'SubGraph',
    )
    expect(subGraphMenu?.children?.map((c) => c.label)).toEqual([
      'Input Handle',
      'Output Handle',
      'Graph Name',
    ])
  })

  it('adds a node of the derived type when a menu action runs', () => {
    const ws = createWorkspaceWithProviders()
    const addNode = addNodeItem(ws)

    const mathOp = addNode.children!.find((c) => c.label === 'Math')!
    mathOp.children![0]!.action?.()

    const nodes = ws.nodes
    expect(nodes.length).toBe(1)
    expect(nodes[0]!.type).toBe('Math.Op')
  })
})
