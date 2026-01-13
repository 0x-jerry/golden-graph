import { type Arrayable, ensureArray, nanoid, remove } from '@0x-jerry/utils'
import { shallowReactive } from 'vue'
import { CoordSystem } from './CoordSystem'
import { Edge } from './Edge'
import { HandlePosition } from './HandlePosition'
import { createIncrementIdGenerator, type Factory } from './helper'
import type { Node, NodeBaseUpdateOptions } from './Node'
import type { NodeHandle } from './NodeHandle'
import type { IPersistent } from './Persistent'
import { Register } from './Register'
import type { INodeHandleLoc, IWorkspace } from './types'

export class Workspace implements IPersistent<IWorkspace> {
  version = '1.0.0'
  id = nanoid()

  _nodes: Node[] = shallowReactive([])
  _edges: Edge[] = shallowReactive([])

  _idGenerator = createIncrementIdGenerator()

  _nodeRegister = new Register<Factory<Node>>()

  readonly coord = new CoordSystem()

  get nodes() {
    return this._nodes
  }

  get edges() {
    return this._edges
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
    this._edges.splice(0)
    this._nodes.splice(0)
    this._idGenerator.reset(0)
  }

  toJSON(): IWorkspace {
    return {
      version: this.version,
      coordinate: this.coord.toJSON(),
      nodes: this.nodes.map((n) => n.toJSON()),
      edges: this.edges.map((n) => n.toJSON()),
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
  }
}
