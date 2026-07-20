import { describe, expect, it } from 'vitest'
import { HandlePosition, Node, NodeType, Workspace } from '../../src/core'

const calls: string[] = []

class SourceNode extends Node {
  static nodeName = 'Source'
  constructor() {
    super()
    this._type = 'Source'
    this.setNodeType(NodeType.Entry)
    this.addHandle({ key: 'out', position: HandlePosition.Right, type: 'number', value: 1 })
  }
  onProcess = () => {
    calls.push(this.name)
  }
}

class StepNode extends Node {
  static nodeName = 'Step'
  constructor() {
    super()
    this._type = 'Step'
    this.addHandle({ key: 'in', position: HandlePosition.Left, type: 'number' })
    this.addHandle({ key: 'out', position: HandlePosition.Right, type: 'number' })
  }
  onProcess = () => {
    calls.push(this.name)
    const n = this.getData<number>('in') ?? 0
    this.setData('out', n + 1)
  }
}

class JoinNode extends Node {
  static nodeName = 'Join'
  constructor() {
    super()
    this._type = 'Join'
    this.addHandle({ key: 'a', position: HandlePosition.Left, type: 'number' })
    this.addHandle({ key: 'b', position: HandlePosition.Left, type: 'number' })
    this.addHandle({ key: 'out', position: HandlePosition.Right, type: 'number' })
  }
  onProcess = () => {
    calls.push(this.name)
    const a = this.getData<number>('a') ?? 0
    const b = this.getData<number>('b') ?? 0
    this.setData('out', a + b)
  }
}

class FailingNode extends Node {
  static nodeName = 'Failing'
  constructor() {
    super()
    this._type = 'Failing'
    this.addHandle({ key: 'in', position: HandlePosition.Left, type: 'number' })
  }
  onProcess = () => {
    throw new Error('boom')
  }
}

function createWs() {
  const ws = new Workspace()
  ws.registerNode('Source', SourceNode)
  ws.registerNode('Step', StepNode)
  ws.registerNode('Join', JoinNode)
  ws.registerNode('Failing', FailingNode)
  return ws
}

describe('Executor', () => {
  it('processes dependencies before dependents', async () => {
    calls.length = 0
    const ws = createWs()

    const s = ws.addNode('Source')
    const p1 = ws.addNode('Step')
    const p2 = ws.addNode('Step')
    p1.name = 'Step1'
    p2.name = 'Step2'

    ws.connect(s.getHandle('out')!, p1.getHandle('in')!)
    ws.connect(p1.getHandle('out')!, p2.getHandle('in')!)

    await ws.execute()

    expect(calls).toEqual(['Source', 'Step1', 'Step2'])
    expect(p2.getData('out')).toBe(3)
  })

  it('processes a diamond graph once per node', async () => {
    calls.length = 0
    const ws = createWs()

    const s = ws.addNode('Source')
    const left = ws.addNode('Step')
    const right = ws.addNode('Step')
    const join = ws.addNode('Join')
    left.name = 'Left'
    right.name = 'Right'

    ws.connect(s.getHandle('out')!, left.getHandle('in')!)
    ws.connect(s.getHandle('out')!, right.getHandle('in')!)
    ws.connect(left.getHandle('out')!, join.getHandle('a')!)
    ws.connect(right.getHandle('out')!, join.getHandle('b')!)

    await ws.execute()

    expect(calls.length).toBe(4)
    expect(calls[0]).toBe('Source')
    expect(calls.indexOf('Join')).toBeGreaterThan(calls.indexOf('Left'))
    expect(calls.indexOf('Join')).toBeGreaterThan(calls.indexOf('Right'))
    expect(join.getData('out')).toBe(4)
  })

  it('skips onProcess when node data is unchanged', async () => {
    calls.length = 0
    const ws = createWs()

    const s = ws.addNode('Source')
    const p = ws.addNode('Step')
    ws.connect(s.getHandle('out')!, p.getHandle('in')!)

    await ws.execute()
    expect(calls.length).toBe(2)

    // second run with identical data: nothing re-processes
    await ws.execute()
    expect(calls.length).toBe(2)

    // changing source data invalidates the cache and re-processes
    s.setData('out', 10)
    await ws.execute()
    expect(calls.length).toBe(4)
    expect(p.getData('out')).toBe(11)
  })

  it('resets state after a failing node', async () => {
    const ws = createWs()

    const s = ws.addNode('Source')
    const f = ws.addNode('Failing')
    ws.connect(s.getHandle('out')!, f.getHandle('in')!)

    await expect(ws.execute()).rejects.toThrow()

    expect(ws.executorState.isProcessing).toBe(false)
    expect(ws.executorState.currentNodeId).toBe(-1)
    // workspace is usable again after the failure
    expect(ws.disabled).toBe(false)
  })
})
