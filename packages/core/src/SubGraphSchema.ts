import { HandlePosition } from './HandlePosition'
import { type Node, NodeType } from './Node'
import type { INodeHandleConfig } from './NodeHandle'
import type { INodeSchema } from './NodeSchema'

export const SUBGRAPH_INPUT_NODE_TYPE = 'subgraph.input'
export const SUBGRAPH_OUTPUT_NODE_TYPE = 'subgraph.output'

/**
 * Schema of the subgraph interface input node (entry point inside a
 * subgraph workspace). Registered automatically by every `Workspace`.
 */
export const subGraphInputNodeSchema: INodeSchema = {
  type: SUBGRAPH_INPUT_NODE_TYPE,
  name: 'Input Handle',
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
      options: {
        type: 'text',
      },
    },
    // todo, use a select component
    {
      name: 'Type',
      key: 'Type',
      type: 'string',
    },
  ],
}

/**
 * Schema of the subgraph interface output node (result of a subgraph
 * workspace). Registered automatically by every `Workspace`.
 */
export const subGraphOutputNodeSchema: INodeSchema = {
  type: SUBGRAPH_OUTPUT_NODE_TYPE,
  name: 'Output Handle',
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
      options: {
        type: 'text',
      },
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

export function subGraphInputToHandleConfig(node: Node): INodeHandleConfig {
  const conf: INodeHandleConfig = {
    name: node.getData('Name'),
    // Key by the interface node id — stable across renames of the display
    // name, so external edges survive `exitSubGraph`.
    key: String(node.id),
    type: node.getData('Type'),
    position: HandlePosition.Left,
  }

  return conf
}

export function subGraphOutputToHandleConfig(node: Node): INodeHandleConfig {
  const conf: INodeHandleConfig = {
    name: node.getData('Name'),
    key: String(node.id),
    type: node.getData('Type'),
    position: HandlePosition.Right,
  }

  return conf
}
