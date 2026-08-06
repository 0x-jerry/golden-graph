import { describe, it, expect } from 'vitest'
import { Group, Workspace } from '@0x-jerry/golden-graph'
import type { IVec2 } from '@0x-jerry/golden-graph'
import { syncGroupMembership } from '../../src/renderer/groupMembership'

const nodeSchema = {
  type: 'Test.Node',
  name: 'Test Node',
  handles: [] as Array<{
    key: string
    name: string
    accepts: string
    position: number
  }>,
}

function makeWorkspace() {
  const ws = new Workspace()
  ws.registerNodeSchema(nodeSchema)
  return ws
}

function makeGroup(
  ws: Workspace,
  pos: IVec2,
  size: IVec2,
  nodes: number[] = [],
) {
  const group = new Group()
  group.id = ws.nextId()
  group.setWorkspace(ws)
  group.setPos(pos)
  group.setSize(size)
  group.nodes.push(...nodes)
  ws._groups.push(group)
  return group
}

function makeNode(ws: Workspace, pos: IVec2, size: IVec2 = { x: 50, y: 50 }) {
  const node = ws.addNode('Test.Node')
  node.moveTo(pos.x, pos.y)
  node.setSize(size)
  return node
}

describe('syncGroupMembership', () => {
  it('adds a node that ends up fully inside a group', () => {
    const ws = makeWorkspace()
    const node = makeNode(ws, { x: 0, y: 0 })
    const group = makeGroup(ws, { x: 0, y: 0 }, { x: 100, y: 100 })

    syncGroupMembership(ws)

    expect(group.nodes).toEqual([node.id])
  })

  it('lets a member follow the group when the group moves', () => {
    const ws = makeWorkspace()
    const node = makeNode(ws, { x: 0, y: 0 })
    const group = makeGroup(ws, { x: 0, y: 0 }, { x: 100, y: 100 })

    syncGroupMembership(ws)
    group.move({ x: 10, y: 20 })

    expect(node.pos).toEqual({ x: 10, y: 20 })
  })

  it('disconnects a member once it no longer overlaps the group', () => {
    const ws = makeWorkspace()
    const node = makeNode(ws, { x: 0, y: 0 })
    const group = makeGroup(ws, { x: 0, y: 0 }, { x: 100, y: 100 }, [node.id])

    node.moveTo(200, 200)
    syncGroupMembership(ws)

    expect(group.nodes).toEqual([])
  })

  it('keeps a member that only partially overlaps the group', () => {
    const ws = makeWorkspace()
    const node = makeNode(ws, { x: 80, y: 80 })
    const group = makeGroup(ws, { x: 0, y: 0 }, { x: 100, y: 100 }, [node.id])

    syncGroupMembership(ws)

    expect(group.nodes).toEqual([node.id])
  })

  it('adds a node that only partially overlaps the group', () => {
    const ws = makeWorkspace()
    const node = makeNode(ws, { x: 80, y: 80 })
    const group = makeGroup(ws, { x: 0, y: 0 }, { x: 100, y: 100 })

    syncGroupMembership(ws)

    expect(group.nodes).toEqual([node.id])
  })

  it('drops a member after the group is resized past it', () => {
    const ws = makeWorkspace()
    const node = makeNode(ws, { x: 110, y: 110 })
    const group = makeGroup(ws, { x: 0, y: 0 }, { x: 200, y: 200 }, [node.id])

    group.setSize({ x: 100, y: 100 })
    syncGroupMembership(ws)

    expect(group.nodes).toEqual([])
  })

  it('preserves member order and appends new members', () => {
    const ws = makeWorkspace()
    const a = makeNode(ws, { x: 0, y: 0 })
    const b = makeNode(ws, { x: 10, y: 10 })
    const group = makeGroup(ws, { x: 0, y: 0 }, { x: 100, y: 100 }, [b.id])

    syncGroupMembership(ws)

    expect(group.nodes).toEqual([b.id, a.id])
  })

  it('drops stale member ids of removed nodes', () => {
    const ws = makeWorkspace()
    const node = makeNode(ws, { x: 0, y: 0 })
    const group = makeGroup(ws, { x: 0, y: 0 }, { x: 100, y: 100 }, [node.id])

    ws.removeNodeByIds(node.id)
    syncGroupMembership(ws)

    expect(group.nodes).toEqual([])
  })

  it('emits group:changed only when membership changes', () => {
    const ws = makeWorkspace()
    makeNode(ws, { x: 0, y: 0 })
    const group = makeGroup(ws, { x: 0, y: 0 }, { x: 100, y: 100 })

    let changes = 0
    ws.events.on('group:changed', (g) => {
      if (g.id === group.id) changes++
    })

    syncGroupMembership(ws)
    expect(changes).toBe(1)

    syncGroupMembership(ws)
    expect(changes).toBe(1)
  })
})
