import {
  type Arrayable,
  EventEmitter,
  ensureArray,
  nanoid,
  remove,
} from '@0x-jerry/utils'
import { uniq } from 'lodash-es'
import { CoordSystem } from './CoordSystem'
import { Edge } from './Edge'
import { Executor } from './Executor'
import type { ExecutorBackend } from './ExecutorBackend'
import { Group } from './Group'
import { convertGroupToSubGraph } from './GroupToSubGraph'
import {
  createIncrementIdGenerator,
  edgeLocKey,
  toReadonly,
} from './helper'
import {
  type Node,
  type NodeBaseUpdateOptions,
  type NodeConstructor,
  NodeType,
} from './Node'
import type { NodeHandle } from './NodeHandle'
import { nodeClassFromSchema, type INodeSchema } from './NodeSchema'
import type { IPersistent } from './Persistent'
import { Register } from './Register'
import { SubGraph } from './SubGraph'
import {
  subGraphInputNodeSchema,
  subGraphOutputNodeSchema,
} from './SubGraphSchema'
import type {
  IDisposable,
  INodeHandleLoc,
  IRenderer,
  IVec2,
  IWorkspace,
} from './types'

export interface WorkspaceEvents {
  'node:added': [node: Node]
  'node:removed': [node: Node]
  'node:changed': [node: Node]

  /**
   * Node handle value updated.
   */
  'handle:updated': [handle: NodeHandle]
  'handle:connection-changed': [handle: NodeHandle]

  'edge:added': [edge: Edge]
  'edge:removed': [edge: Edge]

  'group:added': [group: Group]
  'group:removed': [group: Group]
  'group:changed': [group: Group]

  'subgraph:added': [subgraph: SubGraph]
  'subgraph:removed': [subgraph: SubGraph]

  'coord:changed': [coord: CoordSystem]

  'state:changed': [
    state: {
      debug: boolean
      disabled: boolean
      activeIds: number[]
      activeType: ActiveType
    },
  ]

  'executor:changed': [state: { isProcessing: boolean; currentNodeId: number }]
}

export enum ActiveType {
  None = 0,
  Node = 1,
  Group = 2,
  Edge = 3,
}

interface IWorkspaceData {
  subGraphId: number
  data: IWorkspace
}

export interface WorkspaceOptions {
  /**
   * Optional executor backend. When provided, `execute()` runs the
   * workflow on the backend (e.g. a Web Worker, or any remote service
   * implementing the executor protocol) instead of in-process.
   */
  executorBackend?: ExecutorBackend
}

export class Workspace implements IPersistent<IWorkspace>, IDisposable {
  readonly version = '1.0.0'
  readonly id = nanoid()
  _renderer?: IRenderer

  readonly events = new EventEmitter<WorkspaceEvents>()
  readonly coord = new CoordSystem(this)

  _nodes: Node[] = []
  _edges: Edge[] = []
  /**
   * Index of edges by endpoint handle loc, for fast `queryEdges` lookups.
   */
  _edgeIndex = new Map<string, Edge[]>()
  _groups: Group[] = []
  _subGraphs: SubGraph[] = []

  _idGenerator = createIncrementIdGenerator()

  _nodeRegister = new Register<NodeConstructor>()

  _executor: Executor

  _workspaceDataStack: IWorkspaceData[] = []

  _state = {
    debug: false,
    disabled: false,
    /**
     * Current selected item, maybe it is node, edge, or group.
     */
    activeIds: [] as number[],
    activeType: ActiveType.None,
  }

  constructor(options?: WorkspaceOptions) {
    this._executor = new Executor(this, options?.executorBackend)

    // Internal node types must always be registered so that `fromJSON`
    // (e.g. `enterSubGraph`) can restore subgraph interface nodes.
    this.registerNodeSchema(subGraphInputNodeSchema)
    this.registerNodeSchema(subGraphOutputNodeSchema)
  }

  get state() {
    return toReadonly(this._state)
  }

  get nodes() {
    return toReadonly(this._nodes)
  }

  get edges() {
    return toReadonly(this._edges)
  }

  get groups() {
    return toReadonly(this._groups)
  }

  get subGraphs() {
    return toReadonly(this._subGraphs)
  }

  get disabled() {
    return this._state.disabled || this._executor.state.isProcessing
  }

  get executorState() {
    return this._executor.state
  }

  get isActiveSubGraph() {
    return this._workspaceDataStack.length > 0
  }

  get nodeRegister() {
    return toReadonly(this._nodeRegister)
  }

  get renderer() {
    return this._renderer
  }

  setRenderer(renderer?: IRenderer) {
    this._renderer = renderer
  }

  /**
   * Attach (or replace) the executor backend after construction. The
   * backend serves node schemas via `getNodeSchemas()` and runs
   * workflows on `execute()`.
   */
  setExecutorBackend(backend: ExecutorBackend) {
    this._executor.backend = backend
  }

  /**
   * Register a node by its JSON schema. The workspace only uses the
   * schema to render generic node instances — the matching execute
   * function lives on the backend that served the schema.
   */
  registerNodeSchema(schema: INodeSchema) {
    this._nodeRegister.set(schema.type, nodeClassFromSchema(schema))
  }

  /**
   * Fetch all node schemas from the configured executor backend and
   * register them for rendering. Call this once after attaching a
   * backend, before adding nodes to the graph.
   */
  async loadNodeSchemasFromBackend() {
    const backend = this._executor.backend

    if (!backend) {
      throw new Error(
        'Can not load node schemas: no executor backend is configured. ' +
          'Pass `executorBackend` to the Workspace options.',
      )
    }

    const schemas = await backend.getNodeSchemas()

    for (const schema of schemas) {
      this.registerNodeSchema(schema)
    }

    return schemas
  }

  moveActiveNodes(delta: IVec2) {
    if (this.state.activeType !== ActiveType.Node) {
      return
    }

    const items = this.queryNodes(...this.state.activeIds)
    for (const item of items) {
      item.move(delta.x, delta.y)
    }
  }

  addNode<T extends NodeBaseUpdateOptions>(type: string, opt?: T) {
    const factory = this._nodeRegister.get(type)
    if (!factory) {
      throw new Error(`Node [${type}] is not registered!`)
    }

    const node = new factory()
    node._type = type

    node.setWorkspace(this)
    node.id = this.nextId()

    if (opt) {
      node.updateByOption(opt)
    }

    this._nodes.push(node)
    this.events.emit('node:added', node)
    return node
  }

  addRawNode(node: Node) {
    node.setWorkspace(this)
    node.id = this.nextId()

    this._nodes.push(node)
    this.events.emit('node:added', node)
  }

  queryNodes(...ids: number[]) {
    return this.nodes.filter((n) => ids.includes(n.id))
  }

  removeNodeByIds(...ids: number[]) {
    const edges = this.queryConnectedEdges(...ids)
    this.removeEdgeByIds(...edges.map((e) => e.id))

    const nodes = remove(this._nodes, (e) => ids.includes(e.id))

    for (const node of nodes) {
      this.events.emit('node:removed', node)
    }

    return nodes
  }

  getNode(id: number) {
    return this.nodes.find((n) => n.id === id)
  }

  addGroup(nodeIds: number[]) {
    if (!nodeIds.length) {
      return
    }

    if (!this._renderer) {
      throw new Error(
        'Renderer not set. Call workspace.setRenderer() before addGroup().',
      )
    }

    const rect = this._renderer.getNodesBounding(nodeIds)

    if (
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height)
    ) {
      throw new Error(
        `Can not compute bounding box for nodes: [${nodeIds.join(', ')}]`,
      )
    }

    const padding = 40
    const headerHeight = 50

    const g = new Group()
    g.id = this.nextId()

    g.setWorkspace(this)
    g.setPos({
      x: rect.x - padding,
      y: rect.y - padding - headerHeight,
    })
    g.setSize({
      x: rect.width + padding * 2,
      y: rect.height + padding * 2 + headerHeight,
    })

    g.nodes.push(...nodeIds)

    this._groups.push(g)
    this.events.emit('group:added', g)
  }

  removeGroup(groupId: number) {
    const groups = remove(this._groups, (g) => g.id === groupId)
    for (const g of groups) {
      this.events.emit('group:removed', g)
    }
    return groups
  }

  convertGroupToSubGraph(groupId: number) {
    const subGraph = convertGroupToSubGraph(this, groupId)

    this.addSubGraph(subGraph)
  }

  addSubGraph(subGraph: SubGraph) {
    if (this.subGraphs.find((g) => g.id === subGraph.id)) {
      throw new Error(`SubGraph [${subGraph.id}] is already added!`)
    }

    this._subGraphs.push(subGraph)
    this.events.emit('subgraph:added', subGraph)
  }

  removeSubGraph(subGraphId: number) {
    const removed = remove(this._subGraphs, (g) => g.id === subGraphId)
    for (const s of removed) {
      this.events.emit('subgraph:removed', s)
    }
    return removed
  }

  enterSubGraph(subGraphId: number) {
    const subGraph = this.subGraphs.find((g) => g.id === subGraphId)
    if (!subGraph) {
      return
    }

    this._workspaceDataStack.push({
      subGraphId: subGraphId,
      data: this.toJSON(),
    })

    const data = subGraph.workspace.toJSON()
    this.fromJSON(data)
  }

  exitSubGraph() {
    const prevData = this._workspaceDataStack.pop()
    if (!prevData) {
      throw new Error('Current workspace is not a Sub Graph')
    }

    const subGraphWorkspaceData = this.toJSON()

    this.fromJSON(prevData.data)

    const subGraph = this._subGraphs.find((n) => n.id === prevData.subGraphId)
    if (!subGraph) {
      throw new Error(`Can not find subGraph by id ${prevData.subGraphId}`)
    }

    subGraph.workspace.fromJSON(subGraphWorkspaceData)

    // remove old sub graph node and rebuild new sub graph node

    const oldSubGraphNode = this.nodes.find((n) => n.subGraphId === subGraph.id)
    if (!oldSubGraphNode) {
      throw new Error(`Can not find sub graph node by id ${subGraph.id}`)
    }

    const newSubGraphNode = subGraph.buildNode()
    newSubGraphNode.setWorkspace(this)
    newSubGraphNode.fromJSON({
      ...oldSubGraphNode.toJSON(),
      data: {},
    })

    const edges = this.queryConnectedEdges(oldSubGraphNode.id)

    const connections = edges.map((edge) => {
      const isStart = edge.start.node.id === oldSubGraphNode.id
      const myHandle = isStart ? edge.start : edge.end
      const otherHandle = isStart ? edge.end : edge.start

      const isOtherOnOldNode = otherHandle.node.id === oldSubGraphNode.id

      return {
        myHandleKey: myHandle.key,
        otherHandle,
        otherHandleKey: otherHandle.key,
        isOtherOnOldNode,
      }
    })

    this.removeNodeByIds(oldSubGraphNode.id)
    this.addRawNode(newSubGraphNode)

    for (const conn of connections) {
      const newHandle = newSubGraphNode.getHandle(conn.myHandleKey)

      const targetHandle = conn.isOtherOnOldNode
        ? newSubGraphNode.getHandle(conn.otherHandleKey)
        : conn.otherHandle

      if (newHandle && targetHandle) {
        this.connect(targetHandle, newHandle)
      }
    }
  }

  copySubGraphNode(subGraphId: number) {
    const subGraph = this._subGraphs.find((n) => n.id === subGraphId)

    if (!subGraph) {
      throw new Error(`Can not find subGraph by id ${subGraphId}`)
    }

    const node = subGraph.buildNode()

    this.addRawNode(node)

    return node
  }

  canConnect(start: NodeHandle, end: NodeHandle): boolean {
    if (start.position === end.position) {
      return false
    }

    return start.canConnectTo(end)
  }

  connect(start: NodeHandle, end: NodeHandle) {
    if (!this.canConnect(start, end)) {
      console.warn('handle %o can not connect to handle %o', start.loc, end.loc)
      return
    }

    const inputHandle = start.isLeft ? start : end
    this.removeConnectedEdgesByHandle(inputHandle)

    const edge = new Edge()
    edge.setWorkspace(this)
    edge.id = this.nextId()

    edge.setEndpoints(start, end)

    this._addEdge(edge)

    return edge
  }

  /**
   * Add an edge to the workspace, keep the edge index up-to-date and emit
   * `edge:added`.
   * @internal
   */
  _addEdge(edge: Edge) {
    this._edges.push(edge)
    this._indexEdge(edge)
    this.events.emit('edge:added', edge)
  }

  _indexEdge(edge: Edge) {
    for (const loc of [edge.start.loc, edge.end.loc]) {
      const key = edgeLocKey(loc)
      const list = this._edgeIndex.get(key)
      if (list) {
        list.push(edge)
      } else {
        this._edgeIndex.set(key, [edge])
      }
    }
  }

  _unindexEdge(edge: Edge) {
    if (!edge._start || !edge._end) {
      return
    }

    for (const loc of [edge._start.loc, edge._end.loc]) {
      const key = edgeLocKey(loc)
      const list = this._edgeIndex.get(key)
      if (!list) {
        continue
      }

      const filtered = list.filter((e) => e !== edge)
      if (filtered.length) {
        this._edgeIndex.set(key, filtered)
      } else {
        this._edgeIndex.delete(key)
      }
    }
  }

  removeConnectedEdgesByHandle(handle: NodeHandle) {
    const edges = this.queryEdges(handle.loc)
    this.removeEdgeByIds(...edges.map((e) => e.id))
  }

  queryConnectedEdges(...nodeIds: number[]) {
    const handles = nodeIds.flatMap((id) => {
      const node = this.getNode(id)
      if (!node) {
        return []
      }

      return node.handles
    })

    const edges = handles.flatMap((handle) => this.queryEdges(handle.loc))

    return uniq(edges)
  }

  queryEdges(loc: INodeHandleLoc) {
    return this._edgeIndex.get(edgeLocKey(loc)) ?? []
  }

  removeEdgeByIds(...ids: number[]) {
    const edges = remove(this._edges, (e) => ids.includes(e.id))
    for (const edge of edges) {
      // Detach and notify BEFORE clearing endpoints: `clearEndpoints()`
      // fires `handle:connection-changed`, and subscribers may rebuild edge
      // views via the edge index. If the edge were still queryable, a view
      // that was just torn down by `edge:removed` could be re-created.
      this._unindexEdge(edge)
      this.events.emit('edge:removed', edge)
      edge.clearEndpoints()
    }

    return edges
  }

  setActiveIds(type: ActiveType, ids: Arrayable<number>) {
    const _ids = ensureArray(ids)

    const alreadyIncluded =
      type === this._state.activeType &&
      _ids.length === this._state.activeIds.length &&
      _ids.every((id) => this._state.activeIds.includes(id))

    if (alreadyIncluded) {
      return
    }

    this._state.activeIds = _ids
    this._state.activeType = type
    this.events.emit('state:changed', this._state)
  }

  isActive(id: number) {
    return this._state.activeIds.includes(id)
  }

  clearActiveIds() {
    this.setActiveIds(ActiveType.None, [])
  }

  nextId() {
    return this._idGenerator.next()
  }

  clear() {
    for (const node of this._nodes) {
      this.events.emit('node:removed', node)
    }
    for (const edge of this._edges) {
      // Same ordering as `removeEdgeByIds`: unindex + `edge:removed` before
      // `clearEndpoints()`, so `handle:connection-changed` handlers never
      // find a still-indexed edge whose view was already torn down.
      this._unindexEdge(edge)
      this.events.emit('edge:removed', edge)
      edge.clearEndpoints()
    }
    for (const group of this._groups) {
      this.events.emit('group:removed', group)
    }
    for (const sub of this._subGraphs) {
      this.events.emit('subgraph:removed', sub)
    }

    this._groups.splice(0)
    this._edges.splice(0)
    this._edgeIndex.clear()
    this._nodes.splice(0)
    this._subGraphs.splice(0)

    this._idGenerator.reset(0)

    this.clearActiveIds()

    // NOTE: `_workspaceDataStack` is intentionally left untouched — `clear()`
    // is also used by `fromJSON()` during `enterSubGraph()`, which relies on
    // the stack to restore the parent workspace on `exitSubGraph()`.
  }

  async execute() {
    const nodes = this.nodes.filter((n) => n.nodeType === NodeType.Entry)

    await this._executor.execute(nodes)
  }

  setDebug(enabled: boolean) {
    this._state.debug = enabled
    this.events.emit('state:changed', this._state)
  }

  dispose() {
    this.events.off()
    this._executor.backend?.dispose?.()
  }

  toJSON(): IWorkspace {
    return {
      version: this.version,
      coordinate: this.coord.toJSON(),
      nodes: this.nodes.map((n) => n.toJSON()),
      edges: this.edges.map((n) => n.toJSON()),
      groups: this.groups.map((n) => n.toJSON()),
      subGraphs: this.subGraphs.map((n) => n.toJSON()),
      extra: {
        incrementID: this._idGenerator.current(),
      },
    }
  }

  fromJSON(data: IWorkspace): void {
    if (data.version && data.version !== this.version) {
      console.warn(
        `Workspace data version [${data.version}] differs from current version [${this.version}]`,
      )
    }

    this.clear()

    this._idGenerator.reset(data.extra.incrementID)

    this.coord.fromJSON(data.coordinate)

    for (const subGraph of data.subGraphs) {
      const g = new SubGraph(this)
      g.fromJSON(subGraph)

      this.addSubGraph(g)
    }

    for (const node of data.nodes) {
      // Build and fully restore the node (id, position, data) BEFORE it is
      // registered and `node:added` fires. Creating it via `addNode` /
      // `addRawNode` first would emit the event with a temporary id and a
      // zero position — the renderer would keep a stale node group that is
      // never updated (position stays 0,0) and can never be hit-tested.
      let n: Node

      if (node.subGraphId) {
        const subGraph = this._subGraphs.find((g) => g.id === node.subGraphId)
        if (!subGraph) {
          throw new Error(`Can not find SubGraph by id ${node.subGraphId}`)
        }

        n = subGraph.buildNode()
      } else {
        const factory = this._nodeRegister.get(node.type)
        if (!factory) {
          throw new Error(`Node [${node.type}] is not registered!`)
        }

        n = new factory()
        n._type = node.type
      }

      n.setWorkspace(this)
      n.fromJSON(node)

      this._nodes.push(n)
      this.events.emit('node:added', n)
    }

    for (const edgeData of data.edges) {
      const edge = new Edge()
      edge.setWorkspace(this)

      edge.fromJSON(edgeData)
      this._addEdge(edge)
    }

    for (const group of data.groups) {
      const g = new Group()
      g.setWorkspace(this)

      g.fromJSON(group)

      this._groups.push(g)
      this.events.emit('group:added', g)
    }
  }
}
