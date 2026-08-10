import type { Workspace } from '@0x-jerry/golden-graph'
import {
  SUBGRAPH_NAME_NODE_TYPE,
  isSubGraphNameNode,
} from '@0x-jerry/golden-graph'

export interface AddableNodeOption {
  /** Full node type, e.g. `Math.Op`. */
  type: string
  /** Display name shown in the node header. */
  name: string
  description?: string
  /**
   * Set for options that insert an existing sub-graph node. When set, `type`
   * is only an identifier (`subgraph:<id>`) — creation must go through the
   * sub-graph path in `addNodeFromOption`, not `ws.addNode`.
   */
  subGraphId?: number
}

export interface AddableNodeGroup {
  providerId: string
  providerName: string
  nodes: AddableNodeOption[]
}

/**
 * Flatten the registered providers into the groups shown in the "Add Node"
 * dialog. Mirrors the old submenu rules:
 *
 * - internal nodes stay hidden, except the subgraph interface nodes
 *   (`subgraph.input` / `subgraph.output` / `subgraph.name`) while inside a
 *   subgraph's inner workspace;
 * - a subgraph has at most one name node, so it is hidden once one exists.
 */
export function collectAddableNodes(ws: Workspace): AddableNodeGroup[] {
  const groups: AddableNodeGroup[] = []

  for (const provider of ws.providers) {
    const nodes: AddableNodeOption[] = []

    for (const schema of Object.values(provider.nodes)) {
      if (!schema.type) {
        continue
      }

      if (
        schema.internal &&
        !(ws.isActiveSubGraph && provider.id === 'subgraph')
      ) {
        continue
      }

      if (
        schema.type === SUBGRAPH_NAME_NODE_TYPE &&
        ws.nodes.some((n) => n.type === SUBGRAPH_NAME_NODE_TYPE)
      ) {
        continue
      }

      nodes.push({
        type: schema.type,
        name: schema.name,
        description: schema.description,
      })
    }

    if (nodes.length) {
      groups.push({
        providerId: provider.id,
        providerName: provider.name,
        nodes,
      })
    }
  }

  // Existing sub-graphs are insertable as `SubGraphNode`s. They are not
  // registered as node schemas, so they are collected directly from
  // `ws.subGraphs`. `ws.subGraphs` holds only the sub-graphs reachable at the
  // current nesting level (the list is emptied while inside a sub-graph
  // unless it has nested ones), so the group matches what the user can see.
  if (ws.subGraphs.length) {
    groups.push({
      providerId: SUBGRAPH_GROUP_ID,
      providerName: 'Sub Graph',
      nodes: ws.subGraphs.map((subGraph) => {
        const nameNode = subGraph.workspace.nodes.find(isSubGraphNameNode)
        const name =
          nameNode?.getData<string>('Name') || `SubGraph #${subGraph.id}`
        const description = nameNode?.getData<string>('Description')

        return {
          type: `subgraph:${subGraph.id}`,
          name,
          description,
          subGraphId: subGraph.id,
        }
      }),
    })
  }

  return groups
}

/**
 * Add the node represented by `option` to the workspace. Sub-graph options are
 * inserted as `SubGraphNode`s sharing the referenced `SubGraph`; all others go
 * through `ws.addNode`.
 */
export function addNodeFromOption(
  ws: Workspace,
  option: AddableNodeOption,
  pos?: { x: number; y: number },
) {
  if (option.subGraphId != null) {
    const node = ws.copySubGraphNode(option.subGraphId)

    // Keep the inserted node's name in sync with the option shown in the
    // dialog: `buildNode` leaves the default 'SubGraph' name when the
    // sub-graph's name node is missing, while the option falls back to
    // `SubGraph #<id>`.
    node.name = option.name

    if (pos) {
      node.moveTo(pos.x, pos.y)
    }
    return node
  }

  return ws.addNode(option.type, pos && { pos })
}

const SUBGRAPH_GROUP_ID = '__subgraph__'
