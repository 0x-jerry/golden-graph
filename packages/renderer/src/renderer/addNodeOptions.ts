import type { Workspace } from '@0x-jerry/golden-graph'
import { SUBGRAPH_NAME_NODE_TYPE } from '@0x-jerry/golden-graph'

export interface AddableNodeOption {
  /** Full node type, e.g. `Math.Op`. */
  type: string
  /** Display name shown in the node header. */
  name: string
  description?: string
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

  return groups
}
