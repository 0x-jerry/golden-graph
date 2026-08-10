import {
  HandlePosition,
  type INodeHandleConfig,
  type INodeProvider,
  type INodeSchema,
  NodeType,
} from '@0x-jerry/golden-graph-protocol'
import { NodeHandleType } from './NodeHandle'
import type { Node } from './Node'

export const SUBGRAPH_INPUT_NODE_TYPE = 'subgraph.input'
export const SUBGRAPH_OUTPUT_NODE_TYPE = 'subgraph.output'
export const SUBGRAPH_NAME_NODE_TYPE = 'subgraph.name'

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
      accepts: '*',
      position: HandlePosition.Right,
    },
    {
      name: 'Name',
      key: 'Name',
      accepts: 'string',
      type: 'text',
    },
    // todo, use a select component
    {
      name: 'Type',
      key: 'Type',
      accepts: 'string',
      // Accept-anything by default so a freshly added input handle can be
      // connected to external nodes before its type is narrowed.
      value: NodeHandleType.All,
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
      accepts: '*',
      position: HandlePosition.Left,
    },
    {
      name: 'Name',
      key: 'Name',
      accepts: 'string',
      type: 'text',
    },
    {
      name: 'Type',
      key: 'Type',
      accepts: 'string',
      value: 'string',
    },
  ],
}

export function isSubGraphInputNode(node: Node) {
  return node.type === SUBGRAPH_INPUT_NODE_TYPE
}

/**
 * Schema of the subgraph name node (the collapsed `SubGraphNode`'s display
 * name). Auto-created on group → subgraph conversion and registered by every
 * `Workspace`, so the subgraph name survives JSON round-trips and stays
 * editable inside the inner workspace.
 */
export const subGraphNameNodeSchema: INodeSchema = {
  type: SUBGRAPH_NAME_NODE_TYPE,
  name: 'Graph Node Info',
  internal: true,
  handles: [
    {
      name: 'Name',
      key: 'Name',
      accepts: 'string',
      type: 'text',
    },
    {
      name: 'Description',
      key: 'Description',
      accepts: 'string',
      type: 'text',
    },
  ],
}

/**
 * Core-side provider registering the subgraph interface nodes. Registered
 * automatically by every `Workspace` (like the legacy constructor
 * `registerNodeSchema` calls), so `fromJSON` can always restore interface
 * nodes. Node types derive from `'subgraph'` + `'input'`/`'output'` =
 * `subgraph.input` / `subgraph.output`.
 */
export const subGraphNodeProvider: INodeProvider<INodeSchema> = {
  id: 'subgraph',
  name: 'SubGraph',
  nodes: {
    input: subGraphInputNodeSchema,
    output: subGraphOutputNodeSchema,
    name: subGraphNameNodeSchema,
  },
}

export function isSubGraphOutputNode(node: Node) {
  return node.type === SUBGRAPH_OUTPUT_NODE_TYPE
}

export function isSubGraphNameNode(node: Node) {
  return node.type === SUBGRAPH_NAME_NODE_TYPE
}

export function subGraphInputToHandleConfig(node: Node): INodeHandleConfig {
  const conf: INodeHandleConfig = {
    name: node.getData('Name'),
    // Key by the interface node id — stable across renames of the display
    // name, so external edges survive `exitSubGraph`.
    key: String(node.id),
    accepts: node.getData('Type'),
    position: HandlePosition.Left,
  }

  return conf
}

export function subGraphOutputToHandleConfig(node: Node): INodeHandleConfig {
  const conf: INodeHandleConfig = {
    name: node.getData('Name'),
    key: String(node.id),
    accepts: node.getData('Type'),
    position: HandlePosition.Right,
  }

  return conf
}
