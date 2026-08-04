import type { Workspace } from '@0x-jerry/golden-graph'
import type { CoreMenuItem, ContextMenuContext } from './types'
import { ContextMenuTargetType } from './types'

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
  return [
    {
      label: 'Add Node',
      children: Array.from(ws.nodeRegister.entries())
        .filter(([, ctor]) => !ctor.internal)
        .map(([type]) => ({
          label: type,
          action: () => ws.addNode(type, ctx.pos ? { pos: ctx.pos } : undefined),
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
