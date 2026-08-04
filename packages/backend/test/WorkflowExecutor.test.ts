import { describe, expect, it } from 'vitest'
import {
  HandlePosition,
  NodeType,
  type IEdge,
  type INode,
  type INodeHandleLoc,
  type IWorkspace,
  type HandleValueUpdate
} from '@0x-jerry/golden-graph'
import {
  WorkflowExecutor,
  type INodeDefinition,
  type WorkflowExecutorEvents,
} from '../src'

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
      type: 'Join',
      name: 'Join',
      handles: [
        { key: 'a', position: HandlePosition.Left, type: 'number' },
        { key: 'b', position: HandlePosition.Left, type: 'number' },
        { key: 'out', position: HandlePosition.Right, type: 'number' },
      ],
    },
    execute: (ctx) => {
      const a = ctx.getData<number>('a') ?? 0
      const b = ctx.getData<number>('b') ?? 0
      calls.push('Join')
      ctx.setData('out', a + b)
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

let nextEdgeId = 1

function node(
  id: number,
  type: string,
  data: Record<string, unknown> = {},
  extra?: Partial<INode>,
): INode {
  return { id, type, data, pos: { x: 0, y: 0 }, ...extra }
}

function edge(from: INodeHandleLoc, to: INodeHandleLoc): IEdge {
  return { id: nextEdgeId++, type: 'default', start: from, end: to }
}

function graph(partial: Partial<IWorkspace> & Pick<IWorkspace, 'nodes'>): IWorkspace {
  return {
    version: '1.0.0',
    coordinate: { origin: { x: 0, y: 0 }, scale: 1 },
    edges: [],
    groups: [],
    subGraphs: [],
    extra: { incrementID: 1000 },
    ...partial,
  }
}

interface CollectedEvents {
  progress: number[]
  updates: HandleValueUpdate[]
}

function createExecutor(collected?: CollectedEvents) {
  const events: WorkflowExecutorEvents = {
    onProgress: (nodeId) => collected?.progress.push(nodeId),
    onHandleUpdates: (updates) => collected?.updates.push(...updates),
  }

  return new WorkflowExecutor(definitions, events)
}

/**
 * Mimic the frontend applying streamed-back writes to its nodes, so the
 * next snapshot reflects the previous run's results.
 */
function applyUpdates(g: IWorkspace, updates: HandleValueUpdate[]) {
  for (const update of updates) {
    const n = g.nodes.find((n) => n.id === update.nodeId)
    if (n) {
      n.data = { ...n.data, [update.key]: update.value }
    }
  }
}

describe('WorkflowExecutor', () => {
  it('processes dependencies before dependents and resolves inputs through edges', async () => {
    calls.length = 0
    const collected: CollectedEvents = { progress: [], updates: [] }
    const executor = createExecutor(collected)

    const g = graph({
      nodes: [
        node(1, 'Source', { out: 1 }),
        node(2, 'Step', { in: undefined, out: undefined }),
        node(3, 'Step', { in: undefined, out: undefined }),
      ],
      edges: [
        edge({ id: 1, key: 'out' }, { id: 2, key: 'in' }),
        edge({ id: 2, key: 'out' }, { id: 3, key: 'in' }),
      ],
    })

    await executor.execute(g, [1], false)

    expect(calls).toEqual(['Source', 'Step(2)', 'Step(3)'])
    expect(collected.progress).toEqual([1, 2, 3])
    expect(collected.updates).toEqual([
      { nodeId: 2, key: 'out', value: 2 },
      { nodeId: 3, key: 'out', value: 3 },
    ])
  })

  it('processes a diamond graph once per node', async () => {
    calls.length = 0
    const collected: CollectedEvents = { progress: [], updates: [] }
    const executor = createExecutor(collected)

    const g = graph({
      nodes: [
        node(1, 'Source', { out: 1 }),
        node(2, 'Step', { in: undefined, out: undefined }),
        node(3, 'Step', { in: undefined, out: undefined }),
        node(4, 'Join', { a: undefined, b: undefined, out: undefined }),
      ],
      edges: [
        edge({ id: 1, key: 'out' }, { id: 2, key: 'in' }),
        edge({ id: 1, key: 'out' }, { id: 3, key: 'in' }),
        edge({ id: 2, key: 'out' }, { id: 4, key: 'a' }),
        edge({ id: 3, key: 'out' }, { id: 4, key: 'b' }),
      ],
    })

    await executor.execute(g, [1], false)

    expect(calls.length).toBe(4)
    expect(calls[0]).toBe('Source')
    expect(calls.indexOf('Join')).toBeGreaterThan(calls.indexOf('Step(2)'))
    expect(calls.indexOf('Join')).toBeGreaterThan(calls.indexOf('Step(3)'))
    expect(collected.updates).toContainEqual({ nodeId: 4, key: 'out', value: 4 })
  })

  it('skips execution when node data is unchanged across runs', async () => {
    calls.length = 0
    const collected: CollectedEvents = { progress: [], updates: [] }
    const executor = createExecutor(collected)

    const g = graph({
      nodes: [
        node(1, 'Source', { out: 1 }),
        node(2, 'Step', { in: undefined, out: undefined }),
      ],
      edges: [edge({ id: 1, key: 'out' }, { id: 2, key: 'in' })],
    })

    await executor.execute(g, [1], false)
    expect(calls.length).toBe(2)

    // the frontend applies streamed-back writes to its nodes
    applyUpdates(g, collected.updates)
    collected.updates.length = 0

    // second run with identical data: nothing re-processes
    await executor.execute(g, [1], false)
    expect(calls.length).toBe(2)

    // changing source data invalidates the cache and re-processes
    g.nodes[0]!.data!.out = 10
    await executor.execute(g, [1], false)
    expect(calls.length).toBe(4)
    expect(collected.updates).toContainEqual({ nodeId: 2, key: 'out', value: 11 })
  })

  it('drops partial cache after a failure so the next run re-processes', async () => {
    calls.length = 0
    const executor = createExecutor()

    const g = graph({
      nodes: [node(1, 'Source', { out: 1 }), node(2, 'Failing', { in: undefined })],
      edges: [edge({ id: 1, key: 'out' }, { id: 2, key: 'in' })],
    })

    await expect(executor.execute(g, [1], false)).rejects.toThrow('boom')
    expect(calls).toEqual(['Source'])

    // the failed run did not commit cache entries — Source runs again
    await expect(executor.execute(g, [1], false)).rejects.toThrow('boom')
    expect(calls).toEqual(['Source', 'Source'])
  })

  it('guards against infinite loops on unresolvable dependencies', async () => {
    const executor = createExecutor()

    const g = graph({
      nodes: [node(1, 'Step', { in: undefined, out: undefined })],
      edges: [edge({ id: 99, key: 'out' }, { id: 1, key: 'in' })],
    })

    await expect(executor.execute(g, [1], false)).rejects.toThrow(
      /infinity loop/,
    )
  })

  it('executes subgraph nodes by injecting inputs and reading outputs back', async () => {
    calls.length = 0
    const collected: CollectedEvents = { progress: [], updates: [] }
    const executor = createExecutor(collected)

    const g = graph({
      nodes: [
        node(1, 'Source', { out: 1 }),
        node(2, 'DefaultNode', { '1': undefined, '3': undefined }, { subGraphId: 9 }),
        node(3, 'Step', { in: undefined, out: undefined }),
      ],
      edges: [
        edge({ id: 1, key: 'out' }, { id: 2, key: '1' }),
        edge({ id: 2, key: '3' }, { id: 3, key: 'in' }),
      ],
      subGraphs: [
        {
          id: 9,
          workspace: graph({
            nodes: [
              node(1, 'subgraph.input', { Output: undefined, Name: 'x', Type: 'number' }),
              node(2, 'Step', { in: undefined, out: undefined }),
              node(3, 'subgraph.output', { Value: undefined, Name: 'y', Type: 'number' }),
            ],
            edges: [
              edge({ id: 1, key: 'Output' }, { id: 2, key: 'in' }),
              edge({ id: 2, key: 'out' }, { id: 3, key: 'Value' }),
            ],
          }),
        },
      ],
    })

    await executor.execute(g, [1], false)

    // Source(1) -> subgraph(x=1; inner Step -> 2) -> y=2 -> Step(3)
    expect(calls).toEqual(['Source', 'Step(2)', 'Step(3)'])

    // only the subgraph node's own writes are streamed, not nested ones
    expect(collected.updates).toContainEqual({ nodeId: 2, key: '3', value: 2 })
    expect(collected.updates).not.toContainEqual(
      expect.objectContaining({ nodeId: 2, key: 'out' }),
    )
  })

  it('caches subgraph nodes at the parent level across runs', async () => {
    calls.length = 0
    const executor = createExecutor()

    const buildGraph = (sourceValue: number, subY: unknown) =>
      graph({
        nodes: [
          node(1, 'Source', { out: sourceValue }),
          node(2, 'DefaultNode', { '1': undefined, '3': subY }, { subGraphId: 9 }),
        ],
        edges: [edge({ id: 1, key: 'out' }, { id: 2, key: '1' })],
        subGraphs: [
          {
            id: 9,
            workspace: graph({
              nodes: [
                node(1, 'subgraph.input', { Output: undefined, Name: 'x' }),
                node(2, 'Step', { in: undefined, out: undefined }),
                node(3, 'subgraph.output', { Value: undefined, Name: 'y' }),
              ],
              edges: [
                edge({ id: 1, key: 'Output' }, { id: 2, key: 'in' }),
                edge({ id: 2, key: 'out' }, { id: 3, key: 'Value' }),
              ],
            }),
          },
        ],
      })

    await executor.execute(buildGraph(1, 2), [1], false)
    expect(calls).toEqual(['Source', 'Step(2)'])

    // second run: snapshot carries the streamed-back output, nothing changed
    await executor.execute(buildGraph(1, 2), [1], false)
    expect(calls).toEqual(['Source', 'Step(2)'])

    // changed input re-runs the subgraph (nested cache skips unchanged nodes)
    await executor.execute(buildGraph(10, 2), [1], false)
    expect(calls).toEqual(['Source', 'Step(2)', 'Source', 'Step(11)'])
  })
})
