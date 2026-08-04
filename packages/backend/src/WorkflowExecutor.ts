import { sleep } from '@0x-jerry/utils'
import { isEqual } from 'lodash-es'
import type {
  HandleValueUpdate,
  INodeSchema,
  IEdge,
  INode,
  INodeHandleLoc,
  ISubGraph,
  IWorkspace,
} from '@0x-jerry/golden-graph'
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  subGraphInputNodeSchema,
  subGraphOutputNodeSchema,
  NodeType,
  HandlePosition,
  edgeLocKey,
} from '@0x-jerry/golden-graph'

/**
 * Minimal facade handed to a node's execute function. `getData` mirrors
 * the edge-resolution semantics of the old node API: for an input (left)
 * handle connected by an edge it returns the connected output's current
 * value, otherwise the handle's local value from the snapshot.
 */
export interface NodeExecutionContext {
  readonly nodeId: number

  /**
   * Effective value of a handle, resolved through incoming edges for
   * input handles.
   */
  getData<T = unknown>(key: string): T | undefined

  /**
   * Write an output handle value. Writes update the run state and are
   * streamed to the frontend (batched per node).
   */
  setData(key: string, value: unknown): void
}

export type NodeExecuteFn = (
  ctx: NodeExecutionContext,
) => unknown | Promise<unknown>

/**
 * A backend-owned node definition: the JSON shape shared with the
 * frontend plus the function that executes instances of it.
 *
 * `execute` is optional — nodes that only emit a local value (e.g. input
 * sources) or only display one (e.g. display sinks) can omit it.
 */
export interface INodeDefinition {
  schema: INodeSchema
  execute?: NodeExecuteFn
}

export interface WorkflowExecutorEvents {
  onProgress(nodeId: number): void
  onHandleUpdates(updates: HandleValueUpdate[]): void
}

const MAX_ITERATIONS = 100_000

const SILENT_EVENTS: WorkflowExecutorEvents = {
  onProgress: () => {},
  onHandleUpdates: () => {},
}

interface INodeRuntimeInfo {
  inputKeys: Set<string>
  outputKeys: Set<string>
}

interface IGraphIndex {
  nodes: Map<number, INode>
  edgesByLoc: Map<string, IEdge[]>
  subGraphs: Map<number, ISubGraph>
  /**
   * Current handle values, keyed by node id then handle key. Initialized
   * from `INode.data`; `setData` writes update it during the run.
   */
  values: Map<number, Record<string, unknown>>
}

/**
 * JSON-native workflow execution engine.
 *
 * Walks an `IWorkspace` snapshot directly — nodes, edges and subgraphs
 * are plain JSON; no `Workspace`/`Node` instances are involved. This is
 * the reference implementation of the executor protocol's execution
 * semantics; backends in other languages should replicate:
 *
 * - stack-based traversal from the entry nodes, re-queuing a node until
 *   all upstream nodes (sources of edges into its input handles) ran,
 * - input resolution through edges (an input handle reads the connected
 *   output's current value),
 * - a diff cache keyed by node id: a node is re-executed only when its
 *   fully-resolved handle data changed since the last successful run,
 * - subgraph nodes (`INode.subGraphId`): inject the node's inputs into
 *   the nested workspace's `subgraph.input` interface nodes (the
 *   collapsed node's handle keys are the interface node ids), execute the
 *   nested workspace, then read the `subgraph.output` interface nodes'
 *   resolved `Value` back onto the node's output handles,
 * - debug mode paces execution (sleep between nodes) so progress stays
 *   observable.
 *
 * One executor instance serves one graph level; nested subgraph
 * workspaces get lazily-created child executors so each level owns an
 * independent diff cache that survives across runs.
 */
export class WorkflowExecutor {
  _definitions = new Map<string, INodeDefinition>()
  _events: WorkflowExecutorEvents

  /**
   * Diff cache for this graph level, keyed by node id. Persists across
   * runs so unchanged nodes are skipped.
   */
  _cache = new Map<number, Record<string, unknown>>()
  _cacheNew = new Map<number, Record<string, unknown>>()

  /**
   * Child executors for nested subgraph workspaces, keyed by subgraph id.
   */
  _subExecutors = new Map<number, WorkflowExecutor>()

  constructor(
    definitions: Iterable<INodeDefinition>,
    events: WorkflowExecutorEvents,
  ) {
    this._events = events

    for (const def of definitions) {
      this._definitions.set(def.schema.type, def)
    }
  }

  async execute(graph: IWorkspace, entryNodeIds: number[], debug: boolean) {
    await this._executeIndex(indexGraph(graph), entryNodeIds, debug)
  }

  /**
   * @internal
   */
  async _executeIndex(
    index: IGraphIndex,
    entryNodeIds: number[],
    debug: boolean,
  ) {
    try {
      await this._run(index, entryNodeIds, debug)
      this._cache = this._cacheNew
      this._cacheNew = new Map()
    } catch (error) {
      // Drop partial results of the failed run so the next run diffs
      // against the last successful cache instead of stale entries.
      this._cacheNew = new Map()
      throw error
    }
  }

  async _run(index: IGraphIndex, entryNodeIds: number[], debug: boolean) {
    // Use the array as a stack (push/pop are O(1), unlike shift/unshift).
    const stack = [...entryNodeIds].reverse()
    const processed = new Set<number>()

    let i = MAX_ITERATIONS

    while (stack.length) {
      if (!--i) {
        throw new Error('May encountered infinity loop!')
      }

      const nodeId = stack.pop()!

      if (processed.has(nodeId)) {
        continue
      }

      const node = index.nodes.get(nodeId)

      if (!node) {
        continue
      }

      const upstream = this._findUnprocessedUpstream(index, node, processed)

      if (upstream.length) {
        // Re-queue the node and process its dependencies first.
        stack.push(nodeId)
        for (let idx = upstream.length - 1; idx >= 0; idx--) {
          stack.push(upstream[idx]!)
        }

        continue
      }

      await this._process(index, node, debug)

      processed.add(nodeId)

      const downstream = this._findDownstream(index, node)

      for (let idx = downstream.length - 1; idx >= 0; idx--) {
        stack.push(downstream[idx]!)
      }
    }
  }

  async _process(index: IGraphIndex, node: INode, debug: boolean) {
    this._events.onProgress(node.id)

    const prevData = this._cache.get(node.id)
    const currentData = this._resolveAllData(index, node)
    const isTheSameData = isEqual(currentData, prevData)

    if (!isTheSameData) {
      if (debug) {
        await sleep(100)
      }

      const updates: HandleValueUpdate[] = []
      const ctx = this._createContext(index, node, updates)

      if (node.subGraphId != null) {
        await this._processSubGraphNode(index, node, ctx)
      } else {
        const def = this._definitions.get(node.type)

        // Subgraph interface nodes are handled by `_processSubGraphNode` /
        // schema injection and legitimately have no definition. Any other
        // node without a registered definition is a silent no-op today —
        // fail loudly instead so misconfigured graphs are easy to find.
        if (
          !def &&
          node.type !== SUBGRAPH_INPUT_NODE_TYPE &&
          node.type !== SUBGRAPH_OUTPUT_NODE_TYPE
        ) {
          throw new Error(
            `Can not execute node type [${node.type}] (node id ${node.id}): ` +
              'no definition is registered on the backend',
          )
        }

        await def?.execute?.(ctx)
      }

      if (updates.length) {
        this._events.onHandleUpdates(updates)
      }
    }

    // Cache the post-run data: output values written during this run are
    // part of the next run's diff baseline.
    this._cacheNew.set(node.id, this._resolveAllData(index, node))
  }

  async _processSubGraphNode(
    index: IGraphIndex,
    node: INode,
    ctx: NodeExecutionContext,
  ) {
    const subGraphId = node.subGraphId!
    const subGraph = index.subGraphs.get(subGraphId)

    if (!subGraph) {
      throw new Error(`Can not find SubGraph by id ${subGraphId}`)
    }

    const subIndex = indexGraph(subGraph.workspace)

    // Inject the node's inputs into the nested workspace's interface
    // input nodes, matched by the interface node id (the collapsed node's
    // handle key).
    for (const subNode of subGraph.workspace.nodes) {
      if (subNode.type !== SUBGRAPH_INPUT_NODE_TYPE) {
        continue
      }

      setLocalValue(
        subIndex,
        subNode.id,
        'Output',
        ctx.getData(String(subNode.id)),
      )
    }

    const executor = this._subExecutor(subGraphId)

    const entryNodeIds = subGraph.workspace.nodes
      .filter((subNode) => this._isEntryNode(subNode))
      .map((subNode) => subNode.id)

    // Nested runs are not paced and their progress/writes are not
    // streamed — only the subgraph node's own outputs reach the frontend.
    await executor._executeIndex(subIndex, entryNodeIds, false)

    // Read the interface output values back onto the node's handles.
    for (const subNode of subGraph.workspace.nodes) {
      if (subNode.type !== SUBGRAPH_OUTPUT_NODE_TYPE) {
        continue
      }

      ctx.setData(
        String(subNode.id),
        executor._resolveValue(subIndex, subNode, 'Value'),
      )
    }
  }

  _subExecutor(subGraphId: number): WorkflowExecutor {
    let executor = this._subExecutors.get(subGraphId)

    if (!executor) {
      executor = new WorkflowExecutor(this._definitions.values(), SILENT_EVENTS)
      this._subExecutors.set(subGraphId, executor)
    }

    return executor
  }

  _createContext(
    index: IGraphIndex,
    node: INode,
    updates: HandleValueUpdate[],
  ): NodeExecutionContext {
    return {
      nodeId: node.id,
      getData: <T = unknown>(key: string): T | undefined =>
        this._resolveValue(index, node, key) as T | undefined,
      setData: (key: string, value: unknown) => {
        setLocalValue(index, node.id, key, value)
        updates.push({ nodeId: node.id, key, value })
      },
    }
  }

  /**
   * Effective value of a handle: input handles connected by an edge read
   * the connected output's current value; everything else reads the local
   * value from the run state.
   */
  _resolveValue(index: IGraphIndex, node: INode, key: string): unknown {
    const info = this._nodeInfo(index, node)

    if (info.inputKeys.has(key)) {
      const edge = index.edgesByLoc.get(edgeLocKey({ id: node.id, key }))?.[0]

      if (edge) {
        const source = otherEndpoint(edge, { id: node.id, key })
        return index.values.get(source.id)?.[source.key]
      }
    }

    return index.values.get(node.id)?.[key]
  }

  _resolveAllData(index: IGraphIndex, node: INode): Record<string, unknown> {
    const data: Record<string, unknown> = {}

    for (const key of this._allHandleKeys(index, node)) {
      data[key] = this._resolveValue(index, node, key)
    }

    return data
  }

  _allHandleKeys(index: IGraphIndex, node: INode): Set<string> {
    const info = this._nodeInfo(index, node)
    const keys = new Set<string>([...info.inputKeys, ...info.outputKeys])

    // `INode.data` covers every handle (including layout-only handles).
    for (const key of Object.keys(index.values.get(node.id) ?? {})) {
      keys.add(key)
    }

    return keys
  }

  _findUnprocessedUpstream(
    index: IGraphIndex,
    node: INode,
    processed: Set<number>,
  ): number[] {
    const info = this._nodeInfo(index, node)
    const upstream: number[] = []

    for (const key of info.inputKeys) {
      const edges = index.edgesByLoc.get(edgeLocKey({ id: node.id, key })) ?? []

      for (const edge of edges) {
        const other = otherEndpoint(edge, { id: node.id, key })

        if (!processed.has(other.id)) {
          upstream.push(other.id)
        }
      }
    }

    return upstream
  }

  _findDownstream(index: IGraphIndex, node: INode): number[] {
    const info = this._nodeInfo(index, node)
    const downstream: number[] = []

    for (const key of info.outputKeys) {
      const edges = index.edgesByLoc.get(edgeLocKey({ id: node.id, key })) ?? []

      for (const edge of edges) {
        downstream.push(otherEndpoint(edge, { id: node.id, key }).id)
      }
    }

    return downstream
  }

  _isEntryNode(node: INode): boolean {
    return this._schemaOf(node)?.nodeType === NodeType.Entry
  }

  _schemaOf(node: INode): INodeSchema | undefined {
    if (node.type === SUBGRAPH_INPUT_NODE_TYPE) {
      return subGraphInputNodeSchema
    }

    if (node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
      return subGraphOutputNodeSchema
    }

    return this._definitions.get(node.type)?.schema
  }

  /**
   * Input/output handle keys of a node. For schema-defined nodes this
   * comes from the schema; for subgraph nodes the keys are the nested
   * workspace's interface node ids.
   */
  _nodeInfo(index: IGraphIndex, node: INode): INodeRuntimeInfo {
    if (node.subGraphId != null) {
      const subGraph = index.subGraphs.get(node.subGraphId)
      const inputKeys = new Set<string>()
      const outputKeys = new Set<string>()

      for (const subNode of subGraph?.workspace.nodes ?? []) {
        if (subNode.type === SUBGRAPH_INPUT_NODE_TYPE) {
          inputKeys.add(String(subNode.id))
        }

        if (subNode.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
          outputKeys.add(String(subNode.id))
        }
      }

      return { inputKeys, outputKeys }
    }

    const schema = this._schemaOf(node)
    const inputKeys = new Set<string>()
    const outputKeys = new Set<string>()

    for (const handle of schema?.handles ?? []) {
      if (handle.position === HandlePosition.Left) {
        inputKeys.add(handle.key ?? '')
      }

      if (handle.position === HandlePosition.Right) {
        outputKeys.add(handle.key ?? '')
      }
    }

    return { inputKeys, outputKeys }
  }
}

function indexGraph(graph: IWorkspace): IGraphIndex {
  const nodes = new Map<number, INode>()
  const values = new Map<number, Record<string, unknown>>()

  for (const node of graph.nodes) {
    nodes.set(node.id, node)
    values.set(node.id, { ...node.data })
  }

  const edgesByLoc = new Map<string, IEdge[]>()

  for (const edge of graph.edges) {
    for (const loc of [edge.start, edge.end]) {
      const key = edgeLocKey(loc)
      const list = edgesByLoc.get(key)

      if (list) {
        list.push(edge)
      } else {
        edgesByLoc.set(key, [edge])
      }
    }
  }

  const subGraphs = new Map<number, ISubGraph>()

  for (const subGraph of graph.subGraphs) {
    subGraphs.set(subGraph.id, subGraph)
  }

  return { nodes, edgesByLoc, subGraphs, values }
}

function otherEndpoint(edge: IEdge, loc: INodeHandleLoc): INodeHandleLoc {
  return edge.start.id === loc.id && edge.start.key === loc.key
    ? edge.end
    : edge.start
}

function setLocalValue(
  index: IGraphIndex,
  nodeId: number,
  key: string,
  value: unknown,
) {
  let values = index.values.get(nodeId)

  if (!values) {
    values = {}
    index.values.set(nodeId, values)
  }

  values[key] = value
}
