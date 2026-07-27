import { describe, expect, it } from 'vitest'
import {
  ExecutorWorkerHost,
  WorkerExecutorBackend,
  type INodeDefinition,
  type WorkerLike,
  type WorkerScopeLike,
} from '../../src'
import { HandlePosition, NodeType, Workspace } from '@0x-jerry/golden-graph'

const calls: string[] = []

const definitions: INodeDefinition[] = [
  {
    schema: {
      type: 'Source',
      name: 'Source',
      nodeType: NodeType.Entry,
      handles: [
        {
          key: 'out',
          position: HandlePosition.Right,
          type: 'number',
          value: 1,
        },
      ],
    },
    execute: () => {
      calls.push('Source')
    },
  },
  {
    schema: {
      type: 'Step',
      name: 'Step',
      handles: [
        { key: 'in', position: HandlePosition.Left, type: 'number' },
        { key: 'out', position: HandlePosition.Right, type: 'number' },
      ],
    },
    execute: (ctx) => {
      const n = ctx.getData<number>('in') ?? 0
      calls.push(`Step(${n + 1})`)
      ctx.setData('out', n + 1)
    },
  },
  {
    schema: {
      type: 'Failing',
      name: 'Failing',
      handles: [
        { key: 'in', position: HandlePosition.Left, type: 'number' },
      ],
    },
    execute: () => {
      throw new Error('boom')
    },
  },
]

type Listener = (event: { data: unknown }) => void

/**
 * In-process loopback between `WorkerExecutorBackend` and
 * `ExecutorWorkerHost`, standing in for the worker's postMessage channel.
 */
function createLoopback() {
  const hostListeners: Listener[] = []
  const clientListeners: Listener[] = []

  const deliver = (listeners: Listener[], data: unknown) => {
    queueMicrotask(() => {
      for (const listener of listeners) {
        listener({ data: structuredClone(data) })
      }
    })
  }

  const scope: WorkerScopeLike = {
    postMessage: (message) => deliver(clientListeners, message),
    addEventListener: (_type, listener) => {
      hostListeners.push(listener)
    },
  }

  const worker: WorkerLike = {
    postMessage: (message) => deliver(hostListeners, message),
    addEventListener: (_type, listener) => {
      clientListeners.push(listener)
    },
    removeEventListener: () => {},
    terminate: () => {},
  }

  const host = new ExecutorWorkerHost(definitions, scope)
  const backend = new WorkerExecutorBackend(worker)

  return { host, backend }
}

async function createWs() {
  const { backend } = createLoopback()
  const ws = new Workspace({ executorBackend: backend })
  await ws.loadNodeSchemasFromBackend()
  return ws
}

describe('WorkerExecutorBackend', () => {
  it('serves the backend-defined node schemas as JSON', async () => {
    const { backend } = createLoopback()

    const schemas = await backend.getNodeSchemas()

    expect(schemas.map((s) => s.type)).toEqual(['Source', 'Step', 'Failing'])
    expect(schemas[0]).toEqual(definitions[0]!.schema)
  })

  it('registers fetched schemas so nodes can be added and rendered', async () => {
    const ws = await createWs()

    const s = ws.addNode('Source')
    expect(s.name).toBe('Source')
    expect(s.nodeType).toBe(NodeType.Entry)
    expect(s.getHandle('out')?.isRight).toBe(true)
    expect(s.getData('out')).toBe(1)
  })

  it('processes dependencies before dependents and writes results back', async () => {
    calls.length = 0
    const ws = await createWs()

    const s = ws.addNode('Source')
    const p1 = ws.addNode('Step')
    const p2 = ws.addNode('Step')

    ws.connect(s.getHandle('out')!, p1.getHandle('in')!)
    ws.connect(p1.getHandle('out')!, p2.getHandle('in')!)

    await ws.execute()

    expect(calls).toEqual(['Source', 'Step(2)', 'Step(3)'])
    expect(p1.getData('out')).toBe(2)
    expect(p2.getData('out')).toBe(3)
  })

  it('emits executor progress and handle updates on the main workspace', async () => {
    const ws = await createWs()

    const s = ws.addNode('Source')
    const p = ws.addNode('Step')
    ws.connect(s.getHandle('out')!, p.getHandle('in')!)

    const progress: number[] = []
    ws.events.on('executor:changed', (state) => {
      if (state.isProcessing) {
        progress.push(state.currentNodeId)
      }
    })

    const updated: string[] = []
    ws.events.on('handle:updated', (handle) => {
      updated.push(`${handle.node.id}:${handle.key}`)
    })

    await ws.execute()

    expect(progress).toContain(s.id)
    expect(progress).toContain(p.id)
    expect(updated).toContain(`${p.id}:out`)

    expect(ws.executorState.isProcessing).toBe(false)
    expect(ws.executorState.currentNodeId).toBe(-1)
  })

  it('keeps the diff cache on the backend across runs', async () => {
    calls.length = 0
    const ws = await createWs()

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

  it('rejects and resets state after a failing node', async () => {
    const ws = await createWs()

    const s = ws.addNode('Source')
    const f = ws.addNode('Failing')
    ws.connect(s.getHandle('out')!, f.getHandle('in')!)

    await expect(ws.execute()).rejects.toThrow()

    expect(ws.executorState.isProcessing).toBe(false)
    expect(ws.executorState.currentNodeId).toBe(-1)
    expect(ws.disabled).toBe(false)
  })
})
