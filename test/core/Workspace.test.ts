import { describe, it, expect } from 'vitest'
import { HandlePosition, Node, NodeType, Workspace } from '../../src/core'
import { getNodesBounding } from '../../src/core/dom'

class SourceNode extends Node {
  constructor() {
    super()
    this._type = 'Source'
    this.setNodeType(NodeType.Entry)
    this.addHandle({ key: 'out', position: HandlePosition.Right, type: 'number', value: 1 })
  }
  onProcess = () => {
    // no-op: emits existing value
  }
}

class ProcessNode extends Node {
  constructor() {
    super()
    this._type = 'Process'
    this.addHandle({ key: 'in', position: HandlePosition.Left, type: 'number' })
    this.addHandle({ key: 'out', position: HandlePosition.Right, type: 'number' })
  }
  onProcess = () => {
    const n = this.getData<number>('in') ?? 0
    this.setData('out', n + 1)
  }
}

class SinkNode extends Node {
  constructor() {
    super()
    this._type = 'Sink'
    this.addHandle({ key: 'in', position: HandlePosition.Left, type: 'number' })
  }
}

describe('Workspace', () => {
  it('register/add/connect/query/remove edges', () => {
    const ws = new Workspace()
    class A extends Node { constructor() { super(); this._type = 'A'; this.addHandle({ key: 'o', position: HandlePosition.Right, type: 'number' }) } }
    class B extends Node { constructor() { super(); this._type = 'B'; this.addHandle({ key: 'i', position: HandlePosition.Left, type: 'number' }) } }
    ws.registerNode('A', A)
    ws.registerNode('B', B)
    const a = ws.addNode('A')
    const b = ws.addNode('B')
    const edge = ws.connect(a.getHandle('o')!, b.getHandle('i')!)!
    expect(ws.edges.length).toBe(1)
    const edges = ws.queryEdges(a.getHandle('o')!.loc)
    expect(edges[0].id).toBe(edge.id)
    ws.removeEdgeByIds(edge.id)
    expect(ws.edges.length).toBe(0)
  })

  it('getNodesBounding throws when node DOM missing', () => {
    const ws = new Workspace()
    // register and add one node without DOM
    class A extends Node { constructor() { super(); this._type = 'A'; } }
    ws.registerNode('A', A)
    const a = ws.addNode('A', { pos: { x: 10, y: 20 } })
    expect(() => getNodesBounding([a])).toThrow()
  })

  it('execute processes graph and propagates values', async () => {
    const ws = new Workspace()
    ws.registerNode('Source', SourceNode)
    ws.registerNode('Process', ProcessNode)
    ws.registerNode('Sink', SinkNode)

    const s = ws.addNode('Source', { pos: { x: 0, y: 0 } })
    const p = ws.addNode('Process', { pos: { x: 0, y: 0 } })
    const k = ws.addNode('Sink', { pos: { x: 0, y: 0 } })

    ws.connect(s.getHandle('out')!, p.getHandle('in')!)
    ws.connect(p.getHandle('out')!, k.getHandle('in')!)

    await ws.execute()

    expect(p.getData('in')).toBe(1)
    expect(p.getData('out')).toBe(2)
    expect(k.getData('in')).toBe(2)
    expect(ws.executorState.isProcessing).toBe(false)
    expect(ws.executorState.currentNodeId).toBe(-1)
  })

  it('toJSON/fromJSON roundtrip', () => {
    const ws = new Workspace()
    ws.registerNode('Source', SourceNode)
    const s = ws.addNode('Source')
    const json = ws.toJSON()
    const ws2 = new Workspace()
    ws2.registerNode('Source', SourceNode)
    ws2.fromJSON(json)
    expect(ws2.nodes.length).toBe(1)
    expect(ws2.nodes[0].type).toBe(s.type)
  })
})

