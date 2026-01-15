import { EventEmitter, nanoid, remove } from '@0x-jerry/utils'
import { reactive, shallowReactive } from 'vue'
import type { ContextMenuItem } from '../components/ContextMenu.vue'
import { ContextMenuHelper } from './ContextMenu'
import { CoordSystem } from './CoordSystem'
import { getNodesBounding } from './dom'
import { Edge } from './Edge'
import { Executor } from './Executor'
import { Group } from './Group'
import { createIncrementIdGenerator, type Factory } from './helper'
import { type Node, type NodeBaseUpdateOptions, NodeType } from './Node'
import type { NodeHandle } from './NodeHandle'
import type { IPersistent } from './Persistent'
import { Register } from './Register'
import type { INodeHandleLoc, IWorkspace } from './types'

export interface WorkspaceEvents {
  'node:added': [node: Node]
  'node:removed': [node: Node]

  /**
   * Node handle value updated.
   */
  'handle:updated': [handle: NodeHandle]

  'edge:added': [edge: Edge]
  'edge:removed': [edge: Edge]
}

export class Workspace implements IPersistent<IWorkspace> {
  readonly version = '1.0.0'
  readonly id = nanoid()
  readonly events = new EventEmitter<WorkspaceEvents>()
  readonly coord = new CoordSystem()

  _nodes: Node[] = shallowReactive([])
  _edges: Edge[] = shallowReactive([])
  _groups: Group[] = shallowReactive([])

  _idGenerator = createIncrementIdGenerator()

  _nodeRegister = new Register<Factory<Node>>()

  _executor = new Executor(this)

  _ctxMenuHelper = new ContextMenuHelper()

  _state = reactive({
    disabled: false,
    /**
     * Current selected item, maybe it is node, edge, or group.
     */
    activeId: null as number | null,
  })

  get state() {
    return this._state
  }

  get nodes() {
    return this._nodes
  }

  get edges() {
    return this._edges
  }

  get groups() {
    return this._groups
  }

  get disabled() {
    return this._state.disabled || this._executor.state.isProcessing
  }

  get executorState() {
    return this._executor.state
  }

  get contextMenuState() {
    return this._ctxMenuHelper.state
  }

  registerNode<T extends Node>(type: string, node: Factory<T>) {
    this._nodeRegister.set(type, node)
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

    const nodes = this.queryNodes(...nodeIds)
    const rect = getNodesBounding(nodes)

    const padding = 40
    const headerHeight = 50

    const g = new Group()
    g.id = this.nextId()

    g.setWorkspace(this)
    g.pos.x = rect.left - padding
    g.pos.y = rect.top - padding - headerHeight

    g.size.x = rect.right - rect.left + padding * 2
    g.size.y = rect.bottom - rect.top + padding * 2 + headerHeight

    g.nodes.push(...nodeIds)

    this._groups.push(g)
  }

  removeGroup(groupId: number) {
    return remove(this._groups, (g) => g.id === groupId)
  }

  showContextMenus(evt: MouseEvent, menus: ContextMenuItem[]) {
    evt.preventDefault()

    this._ctxMenuHelper.show(evt.clientX, evt.clientY, menus)
  }

  hideContextMenus() {
    this._ctxMenuHelper.hide()
  }

  canConnect(start: NodeHandle, end: NodeHandle) {
    if (start.position === end.position) {
      return
    }

    return start.canConnectTo(end)
  }

  connect(start: NodeHandle, end: NodeHandle) {
    if (!this.canConnect(start, end)) {
      console.warn('handle %o can not connect to handle %o', start.loc, end.loc)
      return
    }

    const edge = new Edge()
    edge.setWorkspace(this)
    edge.id = this.nextId()

    edge.setStart(start)
    edge.setEnd(end)

    this.removeConnectedEdgesByHandle(start)
    this.removeConnectedEdgesByHandle(end)

    this._edges.push(edge)
    this.events.emit('edge:added', edge)

    return edge
  }

  removeConnectedEdgesByHandle(handle: NodeHandle) {
    if (handle.isRight) {
      return
    }

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

    return edges
  }

  queryEdges(loc: INodeHandleLoc) {
    const filtered = this._edges.filter((edge) => {
      return edge.start.is(loc) || edge.end.is(loc)
    })

    return filtered
  }

  removeEdgeByIds(...ids: number[]) {
    const edges = remove(this._edges, (e) => ids.includes(e.id))
    for (const edge of edges) {
      this.events.emit('edge:removed', edge)
    }

    return edges
  }

  setActiveId(id: number | null) {
    this.state.activeId = id
  }

  nextId() {
    return this._idGenerator.next()
  }

  clear() {
    this._groups.splice(0)
    this._edges.splice(0)
    this._nodes.splice(0)

    this._idGenerator.reset(0)
  }

  async execute() {
    const nodes = this.nodes.filter((n) => n.nodeType === NodeType.Entry)

    await this._executor.execute(nodes)
  }

  toJSON(): IWorkspace {
    return {
      version: this.version,
      coordinate: this.coord.toJSON(),
      nodes: this.nodes.map((n) => n.toJSON()),
      edges: this.edges.map((n) => n.toJSON()),
      groups: this.groups.map((n) => n.toJSON()),
      extra: {
        incrementID: this._idGenerator.current(),
      },
    }
  }

  fromJSON(data: IWorkspace): void {
    this._idGenerator.reset(data.extra.incrementID)

    for (const node of data.nodes) {
      const n = this.addNode(node.type)

      n.fromJSON(node)
    }

    for (const edgeData of data.edges) {
      const edge = new Edge()
      edge.setWorkspace(this)

      edge.fromJSON(edgeData)
      this._edges.push(edge)
    }

    for (const group of data.groups) {
      const g = new Group()
      g.setWorkspace(this)

      g.fromJSON(group)

      this._groups.push(g)
    }
  }
}
