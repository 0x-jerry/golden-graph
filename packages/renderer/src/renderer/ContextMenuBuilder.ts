import type { Workspace } from '@0x-jerry/golden-graph'
import { SUBGRAPH_NAME_NODE_TYPE, isSubGraphNode } from '@0x-jerry/golden-graph'
import { autoLayout } from '../layout'
import type { CoreMenuItem, ContextMenuContext } from './types'
import { ContextMenuTargetType } from './types'
import { getNodeWidth } from './constants'
import { getNodeHeight } from './NodeView'

export function buildDefaultContextMenu(
  ctx: ContextMenuContext,
  ws: Workspace,
): CoreMenuItem[] {
  switch (ctx.type) {
    case ContextMenuTargetType.Canvas:
      return canvasMenu(ws, ctx)
    case ContextMenuTargetType.Node:
      return nodeMenu(ws, ctx.id!)
    case ContextMenuTargetType.Group:
      return groupMenu(ws, ctx.id!)
  }
}

function canvasMenu(ws: Workspace, ctx: ContextMenuContext): CoreMenuItem[] {
  const items: CoreMenuItem[] = [
    {
      label: 'Add Node',
      children: addNodeMenu(ws, ctx),
    },
    {
      label: 'Auto Layout',
      action: () => {
        autoLayout(ws, {
          measure: (node) => ({
            width: getNodeWidth(node),
            height: getNodeHeight(node),
          }),
        })
      },
    },
  ]

  if (ws.isActiveSubGraph) {
    items.unshift({
      label: 'Exit SubGraph',
      action: () => ws.exitSubGraph(),
    })
  }

  return items
}

/**
 * "Add Node" submenu: one submenu per node provider (`provider.name`),
 * each listing the provider's non-internal nodes by their display `name`.
 * While inside a subgraph the internal interface nodes (`subgraph.input` /
 * `subgraph.output` / `subgraph.name`) are also exposed so the inner
 * workspace can be edited.
 */
function addNodeMenu(ws: Workspace, ctx: ContextMenuContext): CoreMenuItem[] {
  const children: CoreMenuItem[] = []

  for (const provider of ws.providers) {
    const nodeItems: CoreMenuItem[] = []

    for (const schema of Object.values(provider.nodes)) {
      if (!schema.type) {
        continue
      }

      // The subgraph interface nodes are internal by default — only addable
      // inside a subgraph's inner workspace. Other internal nodes stay hidden.
      if (
        schema.internal &&
        !(ws.isActiveSubGraph && provider.id === 'subgraph')
      ) {
        continue
      }

      // A subgraph has at most one name node; hide the entry once one exists.
      if (
        schema.type === SUBGRAPH_NAME_NODE_TYPE &&
        ws.nodes.some((n) => n.type === SUBGRAPH_NAME_NODE_TYPE)
      ) {
        continue
      }

      nodeItems.push({
        label: schema.name,
        action: () => ws.addNode(schema.type!, ctx.pos ? { pos: ctx.pos } : undefined),
      })
    }

    if (nodeItems.length) {
      children.push({ label: provider.name, children: nodeItems })
    }
  }

  return children
}

function nodeMenu(ws: Workspace, nodeId: number): CoreMenuItem[] {
  const items: CoreMenuItem[] = [
    {
      label: 'Delete',
      shortcut: 'Del',
      action: () => ws.removeNodeByIds(nodeId),
    },
    {
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      action: () => {
        const node = ws.getNode(nodeId)
        if (!node) return

        // SubGraphNodes reuse the same sub-graph workspace on copy.
        if (isSubGraphNode(node) && node.subGraphId) {
          ws.copySubGraphNode(node.subGraphId)
          return
        }

        const json = node.toJSON()
        const clone = ws.addNode(json.type)
        const newId = clone.id
        clone.fromJSON(json)
        clone.id = newId
        clone.move(30, 30)
      },
    },
    {
      label: 'Create Group',
      action: () => {
        const selected = [
          nodeId,
          ...ws.state.activeIds.filter((id) => id !== nodeId),
        ]
        ws.addGroup([...new Set(selected)])
      },
    },
  ]

  const node = ws.getNode(nodeId)
  if (node && isSubGraphNode(node) && node.subGraphId) {
    items.unshift({
      label: 'Enter SubGraph',
      action: () => ws.enterSubGraph(node.subGraphId!),
    })
  }

  return items
}

function groupMenu(ws: Workspace, groupId: number): CoreMenuItem[] {
  return [
    {
      label: 'Ungroup',
      action: () => ws.removeGroup(groupId),
    },
    {
      label: 'Convert to SubGraph',
      action: () => ws.convertGroupToSubGraph(groupId),
    },
    {
      label: 'Delete Group',
      shortcut: 'Del',
      action: () => {
        const group = ws.groups.find((g) => g.id === groupId)
        if (!group) return

        ws.removeNodeByIds(...group.nodes)
        ws.removeGroup(groupId)
      },
    },
  ]
}
