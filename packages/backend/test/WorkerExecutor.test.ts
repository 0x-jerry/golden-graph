import { describe, expect, it } from 'vitest'
import {
  ExecutorWorkerHost,
  WorkerExecutorBackend,
  type INodeDefinition,
  type WorkerLike,
  type WorkerScopeLike,
} from '../src'
import {
  HandlePosition,
  NodeType,
  type INodeProvider,
} from '@0x-jerry/golden-graph-protocol'
import { Workspace } from '@0x-jerry/golden-graph'

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
          accepts: 'number',
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
        { key: 'in', position: HandlePosition.Left, accepts: 'number' },
        { key: 'out', position: HandlePosition.Right, accepts: 'number' },
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
        { key: 'in', position: HandlePosition.Left, accepts: 'number' },
      ],
    },
    execute: () => {
      throw new Error('boom')
    },
  },
]

type Listener = (event: { data: unknown }) => void

function defaultProviders(): INodeProvider<INodeDefinition>[] {
  const nodes: Record<string, INodeDefinition> = {}

  for (const def of definitions) {
    nodes[def.schema.type!] = def
  }

  return [{ id: '', name: 'test', nodes }]
}

/**
 * In-process loopback between `WorkerExecutorBackend` and
 * `ExecutorWorkerHost`, standing in for the worker's postMessage channel.
 */
function createLoopback(providers: INodeProvider<INodeDefinition>[] = defaultProviders()) {
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

  const host = new ExecutorWorkerHost(scope)
  host.addProviders(providers)
  const backend = new WorkerExecutorBackend(worker)

  return { host, backend }
}

async function createWs() {
  const { backend } = createLoopback()
  const ws = new Workspace({ executorBackend: backend })
  await ws.loadNodeProvidersFromBackend()
  return ws
}

describe('WorkerExecutorBackend', () => {
  it('serves the backend-defined node providers as JSON', async () => {
    const { backend } = createLoopback()

    const providers = await backend.getNodeProviders()

    const schemas = providers.flatMap((p) => Object.values(p.nodes))

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

  it('auto-generates node types from provider id + key and executes them', async () => {
    const sourceProvider: INodeProvider<INodeDefinition> = {
      id: '',
      name: 'Base',
      nodes: {
        Source: {
          schema: {
            name: 'Source',
            nodeType: NodeType.Entry,
            handles: [
              { key: 'out', position: HandlePosition.Right, accepts: 'number', value: 1 },
            ],
          },
        },
      },
    }

    const mathProvider: INodeProvider<INodeDefinition> = {
      id: 'Math',
      name: 'Math',
      nodes: {
        Add: {
          schema: {
            name: 'Math - Add',
            handles: [
              { key: 'a', position: HandlePosition.Left, accepts: 'number', value: 0 },
              { key: 'b', position: HandlePosition.Left, accepts: 'number', value: 0 },
              { key: 'out', position: HandlePosition.Right, accepts: 'number', value: 0 },
            ],
          },
          execute: (ctx) => {
            const a = ctx.getData<number>('a') ?? 0
            const b = ctx.getData<number>('b') ?? 0
            ctx.setData('out', a + b)
          },
        },
      },
    }

    const { backend } = createLoopback([sourceProvider, mathProvider])
    const ws = new Workspace({ executorBackend: backend })
    await ws.loadNodeProvidersFromBackend()

    // types are derived (`Math.Add`); the internal `subgraph` provider is
    // registered by the Workspace itself, before the served ones
    expect(ws.providers.map((p) => p.name)).toEqual(['SubGraph', 'Base', 'Math'])
    expect(ws.nodeRegister.has('Math.Add')).toBe(true)

    const source = ws.addNode('Source')
    const n = ws.addNode('Math.Add')
    n.setData('b', 3)

    ws.connect(source.getHandle('out')!, n.getHandle('a')!)

    await ws.execute()
    expect(n.getData('out')).toBe(4)
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
