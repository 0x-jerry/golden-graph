import { describe, expect, it } from 'vitest'
import { HandlePosition, Workspace } from '@0x-jerry/golden-graph'
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
