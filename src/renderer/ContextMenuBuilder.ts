import type { Workspace } from '../core'
import type { CoreMenuItem, ContextMenuContext } from './types'
import { ContextMenuTargetType } from './types'

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
  return [
    {
      label: 'Add Node',
      children: Array.from(ws.nodeRegister.keys()).map((type) => ({
        label: type,
        action: () => ws.addNode(type),
      })),
    },
  ]
}

function nodeMenu(ws: Workspace, nodeId: number): CoreMenuItem[] {
  return [
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
        const json = node.toJSON()
        const clone = ws.addNode(json.type)
        clone.fromJSON(json)
        clone.move(30, 30)
      },
    },
    {
      label: 'Add to Group',
      action: () => {
        const selected = [
          nodeId,
          ...ws.state.activeIds.filter((id) => id !== nodeId),
        ]
        ws.addGroup([...new Set(selected)])
      },
    },
  ]
}

function groupMenu(ws: Workspace, groupId: number): CoreMenuItem[] {
  return [
    {
      label: 'Ungroup',
      action: () => ws.removeGroup(groupId),
    },
    {
      label: 'Convert to SubGraph',
      action: () => ws.covertGroupToSubGraph(groupId),
    },
    {
      label: 'Delete Group',
      shortcut: 'Del',
      action: () => ws.removeGroup(groupId),
    },
  ]
}
