import { remove } from '@0x-jerry/utils'
import { type Node, type NodeBaseUpdateOptions } from '../Node'
import type { IVec2 } from '../types'
import type { Workspace } from './Workspace'
import { ActiveType } from './WorkspaceState'

/**
 * Node CRUD. Mutates `ws._nodes` in place and emits `node:added` /
 * `node:removed` events.
 */
export class NodeManager {
  constructor(readonly ws: Workspace) {}

  addNode<T extends NodeBaseUpdateOptions>(type: string, opt?: T) {
    const factory = this.ws._nodeRegister.get(type)
    if (!factory) {
      throw new Error(`Node [${type}] is not registered!`)
    }

    const node = new factory()
    node._type = type

    node.setWorkspace(this.ws)
    node.id = this.ws.nextId()

    if (opt) {
      node.updateByOption(opt)
    }

    this.ws._nodes.push(node)
    this.ws.events.emit('node:added', node)
    return node
  }

  addRawNode(node: Node) {
    node.setWorkspace(this.ws)
    node.id = this.ws.nextId()

    this.ws._nodes.push(node)
    this.ws.events.emit('node:added', node)
  }

  queryNodes(...ids: number[]) {
    return this.ws.nodes.filter((n) => ids.includes(n.id))
  }

  removeNodeByIds(...ids: number[]) {
    const edges = this.ws.queryConnectedEdges(...ids)
    this.ws.removeEdgeByIds(...edges.map((e) => e.id))

    const nodes = remove(this.ws._nodes, (e) => ids.includes(e.id))

    for (const node of nodes) {
      this.ws.events.emit('node:removed', node)
    }

    return nodes
  }

  getNode(id: number) {
    return this.ws.nodes.find((n) => n.id === id)
  }

  moveActiveNodes(delta: IVec2) {
    if (this.ws.state.activeType !== ActiveType.Node) {
      return
    }

    const items = this.queryNodes(...this.ws.state.activeIds)
    for (const item of items) {
      item.move(delta.x, delta.y)
    }
  }
}
