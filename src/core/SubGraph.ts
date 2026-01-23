import type { Edge } from './Edge'
import { HandlePosition } from './HandlePosition'
import { toReadonly } from './helper'
import { Node, NodeType } from './Node'
import type { INodeHandleConfig } from './NodeHandle'
import type { IPersistent } from './Persistent'
import type { ISubGraph } from './types'
import { Workspace } from './Workspace'

export class SubGraphInputNode extends Node {
  static type = 'subgraph.input'

  constructor() {
    super()
    this._type = SubGraphInputNode.type
    this.name = 'Input'
    this.setNodeType(NodeType.Entry)

    this.addHandle({
      name: 'Output',
      key: 'Output',
      type: '*',
      position: HandlePosition.Right,
    })

    this.addHandle({
      name: 'Name',
      key: 'Name',
      type: 'string',
    })

    // todo, use a select component
    this.addHandle({
      name: 'Type',
      key: 'Type',
      type: 'string',
    })

    this.addHandle({
      name: 'Required',
      key: 'Required',
      type: 'boolean',
      value: false,
    })
  }

  toHandleConfig(): INodeHandleConfig {
    const conf: INodeHandleConfig = {
      name: this.getData('Name'),
      key: this.getData('Name'),
      type: this.getData('Type'),
      position: HandlePosition.Left,
    }

    return conf
  }

  getInputName() {
    return String(this.getData('Name'))
  }

  setOutputValue(value: unknown) {
    this.setData('Output', value)
  }
}

export class SubGraphOutputNode extends Node {
  static type = 'subgraph.output'

  constructor() {
    super()
    this._type = SubGraphOutputNode.type
    this.name = 'Output'

    this.addHandle({
      name: 'Value',
      key: 'Value',
      type: '*',
      position: HandlePosition.Left,
    })

    this.addHandle({
      name: 'Name',
      key: 'Name',
      type: 'string',
    })

    this.addHandle({
      name: 'Type',
      key: 'Type',
      type: 'string',
      value: 'string',
    })
  }

  getOutputName() {
    return String(this.getData('Name'))
  }

  getOutputValue() {
    return this.getData('Value')
  }

  toHandleConfig(): INodeHandleConfig {
    const conf: INodeHandleConfig = {
      name: this.getData('Name'),
      key: this.getData('Name'),
      type: this.getData('Type'),
      position: HandlePosition.Right,
    }

    return conf
  }
}

/**
 * A virtual workspace used by SubGraph
 */
class VirtualWorkspace extends Workspace {
  constructor(ws: Workspace) {
    super()

    for (const [name, factory] of ws.nodeRegister) {
      this.registerNode(name, factory)
    }

    this.fromJSON({
      version: ws.version,
      coordinate: ws.coord.toJSON(),
      nodes: [],
      edges: [],
      groups: [],
      subGraphs: [],
      extra: {
        incrementID: ws._idGenerator.current(),
      },
    })

    // Do no need interactive helpers
    this.interactive.dispose()
  }
}

export class SubGraph implements IPersistent<ISubGraph> {
  id = 0

  _workspace: Workspace

  _node?: Node

  get node() {
    return toReadonly(this._node)
  }

  get workspace() {
    return toReadonly(this._workspace)
  }

  constructor(parentWorkspace: Workspace) {
    this._workspace = new VirtualWorkspace(parentWorkspace)

    this.workspace.registerNode(SubGraphInputNode.type, SubGraphInputNode)
    this.workspace.registerNode(SubGraphOutputNode.type, SubGraphOutputNode)
  }

  buildNode(): Node {
    const inputs = this.workspace.nodes.filter(
      (node) => node instanceof SubGraphInputNode,
    )

    const outputs = this.workspace.nodes.filter(
      (node) => node instanceof SubGraphOutputNode,
    )

    const node = new Node()
    node.setSubGraphId(this.id)

    for (const output of outputs) {
      node.addHandle(output.toHandleConfig())
    }

    for (const input of inputs) {
      node.addHandle(input.toHandleConfig())
    }

    node.onProcess = async () => {
      const data = node.getAllData()

      for (const input of inputs) {
        const name = input.getInputName()
        input.setOutputValue(data[name])
      }

      await this.workspace.execute()

      for (const output of outputs) {
        const name = output.getOutputName()
        const value = output.getOutputValue()
        node.setData(name, value)
      }
    }

    this._node = node
    return node
  }

  addNodes(...nodes: Node[]) {
    nodes.forEach((node) => {
      node.setWorkspace(this.workspace)
      node.id = this.workspace.nextId()

      this.workspace._nodes.push(node)
    })
  }

  addEdges(...edges: Edge[]) {
    edges.forEach((edge) => {
      edge.setWorkspace(this.workspace)
      edge.id = this.workspace.nextId()

      this.workspace._edges.push(edge)
    })
  }

  fromJSON(data: ISubGraph): void {
    this.id = data.id
    this.workspace.fromJSON(data.workspace)
  }

  toJSON(): ISubGraph {
    return {
      id: this.id,
      workspace: this.workspace.toJSON(),
    }
  }
}
