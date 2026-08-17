import type { Workspace } from '@0x-jerry/golden-graph'
import { isSubGraphNode } from '@0x-jerry/golden-graph'
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
      return canvasMenu(ws)
    case ContextMenuTargetType.Node:
      return nodeMenu(ws, ctx.id!)
    case ContextMenuTargetType.Group:
      return groupMenu(ws, ctx.id!)
  }
}

function canvasMenu(ws: Workspace): CoreMenuItem[] {
  const items: CoreMenuItem[] = [
    {
      key: 'add-node',
      label: 'Add Node',
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

function nodeMenu(ws: Workspace, nodeId: number): CoreMenuItem[] {
  const items: CoreMenuItem[] = [
    {
      label: 'Delete',
      shortcut: 'Del',
      action: () => deleteNodeAction(ws, [nodeId]),
    },
    {
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      action: () => duplicateNodeAction(ws, nodeId),
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
      action: () => deleteGroupAction(ws, groupId),
    },
  ]
}

/**
 * Delete a set of nodes. Backs the node context-menu `Delete` item and the
 * `Del`/`Backspace` keyboard shortcut.
 */
export function deleteNodeAction(ws: Workspace, nodeIds: number[]) {
  ws.removeNodeByIds(...nodeIds)
}

/**
 * Delete a group together with its member nodes. Backs the group
 * context-menu `Delete Group` item and the `Del`/`Backspace` keyboard
 * shortcut.
 */
export function deleteGroupAction(ws: Workspace, groupId: number) {
  const group = ws.groups.find((g) => g.id === groupId)
  if (!group) return

  ws.removeNodeByIds(...group.nodes)
  ws.removeGroup(groupId)
}

/**
 * Duplicate a node (reusing the same sub-graph workspace for SubGraphNodes).
 * Backs the node context-menu `Duplicate` item and the `Ctrl+D`/`Cmd+D`
 * keyboard shortcut.
 */
export function duplicateNodeAction(ws: Workspace, nodeId: number) {
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
}
