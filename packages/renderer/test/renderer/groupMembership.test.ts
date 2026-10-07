import { describe, it, expect } from 'vitest'
import { Workspace } from '@0x-jerry/golden-graph'
import type { IVec2 } from '@0x-jerry/golden-graph'
import { syncGroupMembership } from '../../src/renderer/groupMembership'
import { makeGroup } from '../helpers/workspace'

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

function makeNode(ws: Workspace, pos: IVec2, size: IVec2 = { x: 50, y: 50 }) {
  const node = ws.addNode('Test.Node')
  node.moveTo(pos.x, pos.y)
  node.setSize(size)
  return node
}

describe('syncGroupMembership', () => {
  it('adds nodes that fully or partially overlap the group', () => {
    const inside = makeWorkspace()
    const n1 = makeNode(inside, { x: 0, y: 0 })
    const g1 = makeGroup(inside, {
      pos: { x: 0, y: 0 },
      size: { x: 100, y: 100 },
    })
    syncGroupMembership(inside)
    expect(g1.nodes).toEqual([n1.id])

    const partial = makeWorkspace()
    const n2 = makeNode(partial, { x: 80, y: 80 })
    const g2 = makeGroup(partial, {
      pos: { x: 0, y: 0 },
      size: { x: 100, y: 100 },
    })
    syncGroupMembership(partial)
    expect(g2.nodes).toEqual([n2.id])

    // an existing member that keeps overlapping stays put
    const kept = makeWorkspace()
    const n3 = makeNode(kept, { x: 80, y: 80 })
    const g3 = makeGroup(kept, {
      pos: { x: 0, y: 0 },
      size: { x: 100, y: 100 },
      nodes: [n3.id],
    })
    syncGroupMembership(kept)
    expect(g3.nodes).toEqual([n3.id])
  })

  it('lets a member follow the group when the group moves', () => {
    const ws = makeWorkspace()
    const node = makeNode(ws, { x: 0, y: 0 })
    const group = makeGroup(ws, {
      pos: { x: 0, y: 0 },
      size: { x: 100, y: 100 },
    })

    syncGroupMembership(ws)
    group.move({ x: 10, y: 20 })

    expect(node.pos).toEqual({ x: 10, y: 20 })
  })

  it('drops a member that moves away or when the group shrinks past it', () => {
    const moved = makeWorkspace()
    const n1 = makeNode(moved, { x: 0, y: 0 })
    const g1 = makeGroup(moved, {
      pos: { x: 0, y: 0 },
      size: { x: 100, y: 100 },
      nodes: [n1.id],
    })
    n1.moveTo(200, 200)
    syncGroupMembership(moved)
    expect(g1.nodes).toEqual([])

    const shrunk = makeWorkspace()
    const n2 = makeNode(shrunk, { x: 110, y: 110 })
    const g2 = makeGroup(shrunk, {
      pos: { x: 0, y: 0 },
      size: { x: 200, y: 200 },
      nodes: [n2.id],
    })
    g2.setSize({ x: 100, y: 100 })
    syncGroupMembership(shrunk)
    expect(g2.nodes).toEqual([])
  })

  it('preserves member order and appends new members', () => {
    const ws = makeWorkspace()
    const a = makeNode(ws, { x: 0, y: 0 })
    const b = makeNode(ws, { x: 10, y: 10 })
    const group = makeGroup(ws, {
      pos: { x: 0, y: 0 },
      size: { x: 100, y: 100 },
      nodes: [b.id],
    })

    syncGroupMembership(ws)

    expect(group.nodes).toEqual([b.id, a.id])
  })

  it('drops stale member ids of removed nodes', () => {
    const ws = makeWorkspace()
    const node = makeNode(ws, { x: 0, y: 0 })
    const group = makeGroup(ws, {
      pos: { x: 0, y: 0 },
      size: { x: 100, y: 100 },
      nodes: [node.id],
    })

    ws.removeNodeByIds(node.id)
    syncGroupMembership(ws)

    expect(group.nodes).toEqual([])
  })

  it('emits group:changed only when membership changes', () => {
    const ws = makeWorkspace()
    makeNode(ws, { x: 0, y: 0 })
    const group = makeGroup(ws, {
      pos: { x: 0, y: 0 },
      size: { x: 100, y: 100 },
    })

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
