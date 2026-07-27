import type { Edge } from './Edge'
import { HandlePosition } from './HandlePosition'
import { toReadonly } from './helper'
import { Node, NodeType } from './Node'
import type { INodeHandleConfig } from './NodeHandle'
import type { INodeSchema } from './NodeSchema'
import type { IPersistent } from './Persistent'
import type { IDisposable, ISubGraph } from './types'
import { Workspace } from './Workspace'

export const SUBGRAPH_INPUT_NODE_TYPE = 'subgraph.input'
export const SUBGRAPH_OUTPUT_NODE_TYPE = 'subgraph.output'

/**
 * Schema of the subgraph interface input node (entry point inside a
 * subgraph workspace). Registered automatically by every `Workspace`.
 */
export const subGraphInputNodeSchema: INodeSchema = {
  type: SUBGRAPH_INPUT_NODE_TYPE,
  name: 'Input',
  internal: true,
  nodeType: NodeType.Entry,
  handles: [
    {
      name: 'Output',
      key: 'Output',
      type: '*',
      position: HandlePosition.Right,
    },
    {
      name: 'Name',
      key: 'Name',
      type: 'string',
    },
    // todo, use a select component
    {
      name: 'Type',
      key: 'Type',
      type: 'string',
    },
    {
      name: 'Required',
      key: 'Required',
      type: 'boolean',
      value: false,
    },
  ],
}

/**
 * Schema of the subgraph interface output node (result of a subgraph
 * workspace). Registered automatically by every `Workspace`.
 */
export const subGraphOutputNodeSchema: INodeSchema = {
  type: SUBGRAPH_OUTPUT_NODE_TYPE,
  name: 'Output',
  internal: true,
  handles: [
    {
      name: 'Value',
      key: 'Value',
      type: '*',
      position: HandlePosition.Left,
    },
    {
      name: 'Name',
      key: 'Name',
      type: 'string',
    },
    {
      name: 'Type',
      key: 'Type',
      type: 'string',
      value: 'string',
    },
  ],
}

export function isSubGraphInputNode(node: Node) {
  return node.type === SUBGRAPH_INPUT_NODE_TYPE
}

export function isSubGraphOutputNode(node: Node) {
  return node.type === SUBGRAPH_OUTPUT_NODE_TYPE
}

function subGraphInputToHandleConfig(node: Node): INodeHandleConfig {
  const conf: INodeHandleConfig = {
    name: node.getData('Name'),
    key: node.getData('Name'),
    type: node.getData('Type'),
    position: HandlePosition.Left,
  }

  return conf
}

function subGraphOutputToHandleConfig(node: Node): INodeHandleConfig {
  const conf: INodeHandleConfig = {
    name: node.getData('Name'),
    key: node.getData('Name'),
    type: node.getData('Type'),
    position: HandlePosition.Right,
  }

  return conf
}

/**
 * A virtual workspace used by SubGraph
 */
class VirtualWorkspace extends Workspace {
  constructor(ws: Workspace) {
    super()

    for (const [name, factory] of ws.nodeRegister) {
      this._nodeRegister.set(name, factory)
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
  }
}

export class SubGraph implements IPersistent<ISubGraph>, IDisposable {
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
  }

  buildNode(): Node {
    const inputs = this.workspace.nodes.filter(isSubGraphInputNode)

    const outputs = this.workspace.nodes.filter(isSubGraphOutputNode)

    const node = new Node()
    node.setSubGraphId(this.id)

    for (const output of outputs) {
      node.addHandle(subGraphOutputToHandleConfig(output))
    }

    for (const input of inputs) {
      node.addHandle(subGraphInputToHandleConfig(input))
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

      // Edges migrated from another workspace had their handle connections
      // cleared on removal — restore them so data keeps flowing.
      edge.restoreEndpoints()

      this.workspace._addEdge(edge)
    })
  }

  dispose() {
    this._workspace.dispose()
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
