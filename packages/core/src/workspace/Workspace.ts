import { type Arrayable, EventEmitter, nanoid } from '@0x-jerry/utils'
import {
  type INodeHandleLoc,
  type INodeProvider,
  type INodeSchema,
  type IWorkspace,
  type IVec2,
  NodeType,
  type ExecutorBackend,
  normalizeSchemaNodeProvider,
} from '@0x-jerry/golden-graph-protocol'
import { CoordSystem } from '../CoordSystem'
import type { Edge } from '../Edge'
import { Executor } from '../Executor'
import type { Group } from '../Group'
import { createIncrementIdGenerator, toReadonly } from '../helper'
import { type Node, type NodeBaseUpdateOptions } from '../Node'
import type { NodeConstructor } from '../Node'
import type { NodeHandle } from '../NodeHandle'
import type { IPersistent } from '../Persistent'
import { Register } from '../Register'
import type { SubGraph } from '../SubGraph'
import { subGraphNodeProvider } from '../SubGraphSchema'
import type { IDisposable, IRenderer } from '../types'
import { EdgeManager } from './EdgeManager'
import { GroupManager } from './GroupManager'
import { NodeManager } from './NodeManager'
import { NodeSchemaManager } from './NodeSchemaManager'
import { type IWorkspaceData, SubGraphManager } from './SubGraphManager'
import { WorkspacePersistence } from './WorkspacePersistence'
import { ActiveType, WorkspaceState } from './WorkspaceState'

export { ActiveType } from './WorkspaceState'

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

export interface WorkspaceOptions {
  /**
   * Optional executor backend. When provided, `execute()` runs the
   * workflow on the backend (e.g. a Web Worker, or any remote service
   * implementing the executor protocol) instead of in-process.
   */
  executorBackend?: ExecutorBackend
}

/**
 * The workspace facade: owns the shared entity lists and delegates each
 * concern to a small manager module.
 *
 * - `_workspaceState` — selection + debug flags
 * - `_nodeManager` / `_edgeManager` / `_groupManager` / `_subGraphManager` — entity CRUD
 * - `_schemaManager` — node schema registration
 * - `_persistence` — `toJSON` / `fromJSON` / `clear`
 *
 * The `_`-prefixed fields stay on the facade (they are private-by-convention,
 * but intra-package code — e.g. `SubGraph`, renderer test helpers — reads and
 * mutates them directly), while the managers mutate them in place.
 */
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

  _providerRegister = new Map<string, INodeProvider<INodeSchema>>()

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

  _executor: Executor

  readonly _workspaceState = new WorkspaceState(this)
  readonly _nodeManager = new NodeManager(this)
  readonly _edgeManager = new EdgeManager(this)
  readonly _groupManager = new GroupManager(this)
  readonly _subGraphManager = new SubGraphManager(this)
  readonly _schemaManager = new NodeSchemaManager(this)
  readonly _persistence = new WorkspacePersistence(this)

  constructor(options?: WorkspaceOptions) {
    this._executor = new Executor(this, options?.executorBackend)

    // Internal node types must always be registered so that `fromJSON`
    // (e.g. `enterSubGraph`) can restore subgraph interface nodes.
    this.registerNodeProvider(subGraphNodeProvider)
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

  get providers() {
    return toReadonly([...this._providerRegister.values()])
  }

  get renderer() {
    return this._renderer
  }

  setRenderer(renderer?: IRenderer) {
    this._renderer = renderer
  }

  /**
   * Attach (or replace) the executor backend after construction. The
   * backend serves node providers via `getNodeProviders()` and runs
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
    this._schemaManager.registerNodeSchema(schema)
  }

  /**
   * Register a batch of nodes by provider. Each schema's `type` is
   * auto-generated from the provider id + record key (see
   * `deriveNodeType`); re-registering the same provider id merges its
   * nodes with the existing ones.
   */
  registerNodeProvider(provider: INodeProvider<INodeSchema>) {
    const normalized = normalizeSchemaNodeProvider(provider)
    this._providerRegister.set(normalized.id, normalized)

    for (const schema of Object.values(normalized.nodes)) {
      this.registerNodeSchema(schema)
    }
  }

  /**
   * Fetch all node providers from the configured executor backend and
   * register them for rendering. Call this once after attaching a
   * backend, before adding nodes to the graph.
   */
  async loadNodeProvidersFromBackend() {
    return this._schemaManager.loadNodeProvidersFromBackend()
  }

  moveActiveNodes(delta: IVec2) {
    this._nodeManager.moveActiveNodes(delta)
  }

  addNode<T extends NodeBaseUpdateOptions>(type: string, opt?: T) {
    return this._nodeManager.addNode(type, opt)
  }

  addRawNode(node: Node) {
    this._nodeManager.addRawNode(node)
  }

  queryNodes(...ids: number[]) {
    return this._nodeManager.queryNodes(...ids)
  }

  removeNodeByIds(...ids: number[]) {
    return this._nodeManager.removeNodeByIds(...ids)
  }

  getNode(id: number) {
    return this._nodeManager.getNode(id)
  }

  addGroup(nodeIds: number[]) {
    this._groupManager.addGroup(nodeIds)
  }

  removeGroup(groupId: number) {
    return this._groupManager.removeGroup(groupId)
  }

  convertGroupToSubGraph(groupId: number) {
    this._subGraphManager.convertGroupToSubGraph(groupId)
  }

  restoreSubGraph(subGraph: SubGraph) {
    this._subGraphManager.restoreSubGraph(subGraph)
  }

  addSubGraph(subGraph: SubGraph) {
    this._subGraphManager.addSubGraph(subGraph)
  }

  removeSubGraph(subGraphId: number) {
    return this._subGraphManager.removeSubGraph(subGraphId)
  }

  enterSubGraph(subGraphId: number) {
    this._subGraphManager.enterSubGraph(subGraphId)
  }

  exitSubGraph() {
    this._subGraphManager.exitSubGraph()
  }

  copySubGraphNode(subGraphId: number) {
    return this._subGraphManager.copySubGraphNode(subGraphId)
  }

  canConnect(start: NodeHandle, end: NodeHandle): boolean {
    return this._edgeManager.canConnect(start, end)
  }

  connect(start: NodeHandle, end: NodeHandle) {
    return this._edgeManager.connect(start, end)
  }

  /**
   * Add an edge to the workspace, keep the edge index up-to-date and emit
   * `edge:added`.
   * @internal
   */
  _addEdge(edge: Edge) {
    this._edgeManager._addEdge(edge)
  }

  _indexEdge(edge: Edge) {
    this._edgeManager._indexEdge(edge)
  }

  _unindexEdge(edge: Edge) {
    this._edgeManager._unindexEdge(edge)
  }

  removeConnectedEdgesByHandle(handle: NodeHandle) {
    this._edgeManager.removeConnectedEdgesByHandle(handle)
  }

  queryConnectedEdges(...nodeIds: number[]) {
    return this._edgeManager.queryConnectedEdges(...nodeIds)
  }

  queryEdges(loc: INodeHandleLoc) {
    return this._edgeManager.queryEdges(loc)
  }

  removeEdgeByIds(...ids: number[]) {
    return this._edgeManager.removeEdgeByIds(...ids)
  }

  setActiveIds(type: ActiveType, ids: Arrayable<number>) {
    this._workspaceState.setActiveIds(type, ids)
  }

  isActive(id: number) {
    return this._workspaceState.isActive(id)
  }

  clearActiveIds() {
    this._workspaceState.clearActiveIds()
  }

  nextId() {
    return this._idGenerator.next()
  }

  clear() {
    this._persistence.clear()
  }

  async execute() {
    const nodes = this.nodes.filter((n) => n.nodeType === NodeType.Entry)

    await this._executor.execute(nodes)
  }

  setDebug(enabled: boolean) {
    this._workspaceState.setDebug(enabled)
  }

  dispose() {
    this.events.off()
    this._executor.backend?.dispose?.()
  }

  toFullJSON(): IWorkspace {
    const activeSubGraphIds = this._workspaceDataStack
      .map((data) => data.subGraphId)
      .reverse()

    while (this.isActiveSubGraph) {
      this.exitSubGraph()
    }

    const fullData = this.toJSON()

    while (activeSubGraphIds.length) {
      this.enterSubGraph(activeSubGraphIds.pop()!)
    }

    return fullData
  }

  toJSON(): IWorkspace {
    return this._persistence.toJSON()
  }

  fromJSON(data: IWorkspace): void {
    this._persistence.fromJSON(data)
  }
}
