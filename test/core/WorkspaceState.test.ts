import { describe, expect, it } from 'vitest'
import {
  ActiveType,
  HandlePosition,
  Workspace,
  type INodeSchema,
} from '../../src/core'

const flowSchema: INodeSchema = {
  type: 'Flow',
  name: 'Flow',
  handles: [
    { key: 'in', position: HandlePosition.Left, type: 'number' },
    { key: 'out', position: HandlePosition.Right, type: 'number', value: 42 },
  ],
}

function createWs() {
  const ws = new Workspace()
  ws.registerNodeSchema(flowSchema)
  return ws
}

describe('Workspace state', () => {
  it('canConnect always returns a boolean', () => {
    const ws = createWs()
    const a = ws.addNode('Flow')
    const b = ws.addNode('Flow')

    // same position -> false (not undefined)
    expect(ws.canConnect(a.getHandle('in')!, b.getHandle('in')!)).toBe(false)
    expect(ws.canConnect(a.getHandle('out')!, b.getHandle('in')!)).toBe(true)
  })

  it('clear() resets selection state', () => {
    const ws = createWs()
    const a = ws.addNode('Flow')

    ws.setActiveIds(ActiveType.Node, [a.id])
    expect(ws.state.activeIds.length).toBe(1)

    ws.clear()

    expect(ws.state.activeIds.length).toBe(0)
    expect(ws.state.activeType).toBe(ActiveType.None)
  })

  it('keeps edge index consistent after reconnect', () => {
    const ws = createWs()
    const a = ws.addNode('Flow')
    const b = ws.addNode('Flow')
    const c = ws.addNode('Flow')

    ws.connect(a.getHandle('out')!, b.getHandle('in')!)
    expect(ws.queryEdges(b.getHandle('in')!.loc).length).toBe(1)

    // reconnecting the same input replaces the edge and the index follows
    ws.connect(c.getHandle('out')!, b.getHandle('in')!)

    expect(ws.edges.length).toBe(1)
    expect(ws.queryEdges(b.getHandle('in')!.loc).length).toBe(1)
    expect(ws.queryEdges(a.getHandle('out')!.loc).length).toBe(0)
    expect(ws.queryEdges(c.getHandle('out')!.loc).length).toBe(1)
    expect(ws.edges[0]!.start.node.id).toBe(c.id)
  })

  it('toJSON/fromJSON preserves data flow and positions', () => {
    const ws = createWs()
    const a = ws.addNode('Flow', { pos: { x: 11, y: 22 } })
    const b = ws.addNode('Flow', { pos: { x: 300, y: 80 } })
    ws.connect(a.getHandle('out')!, b.getHandle('in')!)

    const ws2 = createWs()
    ws2.fromJSON(ws.toJSON())

    expect(ws2.nodes.length).toBe(2)
    expect(ws2.edges.length).toBe(1)

    const b2 = ws2.nodes.find((n) => n.id === b.id)!
    expect(b2.pos).toEqual({ x: 300, y: 80 })
    expect(b2.getData('in')).toBe(42)
    expect(b2.getHandle('in')!.isConnected).toBe(true)

    // ids keep incrementing without collisions after restore
    const extra = ws2.addNode('Flow')
    expect(ws2.nodes.filter((n) => n.id === extra.id).length).toBe(1)
  })
})
