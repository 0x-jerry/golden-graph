import { nanoid, remove } from '@0x-jerry/utils'
import { shallowReactive, shallowRef } from 'vue'
import type { ContextMenuItem } from '../components/ContextMenu.vue'
import { RectBox } from '../utils/RectBox'
import { ContextMenuHelper } from './ContextMenu'
import { CoordSystem } from './CoordSystem'
import { getNodeDom } from './dom'
import { Edge } from './Edge'
import { Executor } from './Executor'
import { Group } from './Group'
import { createIncrementIdGenerator, type Factory } from './helper'
import { type Node, type NodeBaseUpdateOptions, NodeType } from './Node'
import type { NodeHandle } from './NodeHandle'
import type { IPersistent } from './Persistent'
import { Register } from './Register'
import type { INodeHandleLoc, IWorkspace } from './types'

export class Workspace implements IPersistent<IWorkspace> {
  version = '1.0.0'
  id = nanoid()

  _nodes: Node[] = shallowReactive([])
  _edges: Edge[] = shallowReactive([])
  _groups: Group[] = shallowReactive([])

  _idGenerator = createIncrementIdGenerator()

  _nodeRegister = new Register<Factory<Node>>()

  _executor = new Executor(this)

  _disabled = shallowRef(false)

  _ctxMenuHelper = new ContextMenuHelper()

  readonly coord = new CoordSystem()

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
    return this._disabled.value || this._executor.state.isProcessing
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
    return node
  }

  addGroup(nodeIds: number[]) {
    if (!nodeIds.length) {
      return
    }

    const rect = this.getNodesBounding(...nodeIds)

    const padding = 40
    const headerHeight = 50

    const g = new Group()
    g.setWorkspace(this)
    g.pos.x = rect.left - padding
    g.pos.y = rect.top - padding - headerHeight

    g.size.x = rect.right - rect.left + padding * 2
    g.size.y = rect.bottom - rect.top + padding * 2 + headerHeight

    g.nodes.push(...nodeIds)

    this._groups.push(g)
  }

  deleteGroup(groupId: number) {
    return remove(this._groups, (g) => g.id === groupId)
  }

  showContextMenus(evt: MouseEvent, menus: ContextMenuItem[]) {
    evt.preventDefault()

    this._ctxMenuHelper.show(evt.clientX, evt.clientY, menus)
  }

  hideContextMenus() {
    this._ctxMenuHelper.hide()
  }

  getNodesBounding(...nodeIds: number[]) {
    const nodes = this.queryNodes(...nodeIds)

    let updated = false

    const rect = new RectBox()

    for (const node of nodes) {
      const r = getNodeDom(this.id, node.id)

      if (!r) {
        throw new Error(`Can not find node dom by id: ${node.id}`)
      }

      const left = node.pos.x
      const top = node.pos.y
      const right = left + r.clientWidth
      const bottom = top + r.clientHeight

      if (updated) {
        rect.left = Math.min(rect.left, left)
        rect.top = Math.min(rect.top, top)
        rect.right = Math.max(rect.right, right)
        rect.bottom = Math.max(rect.bottom, bottom)
      } else {
        rect.left = left
        rect.top = top
        rect.right = right
        rect.bottom = bottom

        updated = true
      }
    }

    return rect
  }

  queryNodes(...ids: number[]) {
    return this.nodes.filter((n) => ids.includes(n.id))
  }

  removeNodeByIds(...ids: number[]) {
    return remove(this._edges, (e) => ids.includes(e.id))
  }

  getNode(id: number) {
    return this.nodes.find((n) => n.id === id)
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

    if (!start.multiple) {
      const edges = this.queryEdges(start.loc)
      this.removeNodeByIds(...edges.map((e) => e.id))
    }

    if (!end.multiple) {
      const edges = this.queryEdges(end.loc)
      this.removeNodeByIds(...edges.map((e) => e.id))
    }

    this._edges.push(edge)

    return edge
  }

  removeEdgeByIds(...ids: number[]) {
    remove(this._edges, (e) => ids.includes(e.id))
  }

  queryEdges(loc: INodeHandleLoc) {
    const filtered = this._edges.filter((edge) => {
      return edge.start.is(loc) || edge.end.is(loc)
    })

    return filtered
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
