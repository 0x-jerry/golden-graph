<script setup lang="ts">
import { onMounted, onUnmounted, shallowReactive, useTemplateRef } from 'vue'
import type { Workspace as IWorkspace } from './core'
import type { CoreMenuItem } from './core/ContextMenu'
import { KonvaGraphRenderer } from './renderer'
import type { ContextMenuContext } from './renderer'
import { useWorkspace } from './hooks'
import WorkspaceToolbar from './components/WorkspaceToolbar.vue'
import ContextMenu from './components/ContextMenu.vue'
import type { ContextMenuItem } from './components/ContextMenu.vue'

export interface KonvaRendererProps {
  setup?: (ws: IWorkspace) => void
  showToolbar?: boolean
  showContextMenu?: boolean
  buildContextMenu?: (ctx: ContextMenuContext) => CoreMenuItem[]
}

const props = withDefaults(defineProps<KonvaRendererProps>(), {
  showToolbar: true,
  showContextMenu: true,
})

const containerRef = useTemplateRef<HTMLElement>('container')

const ws = useWorkspace()!

let renderer: KonvaGraphRenderer | null = null

onMounted(() => {
  const el = containerRef.value
  if (!el) return

  props.setup?.(ws)

  renderer = new KonvaGraphRenderer(el, ws, {
    onContextMenu: (ctx, evt) => {
      const menus =
        props.buildContextMenu?.(ctx) ?? defaultBuildContextMenu(ctx, ws)
      ws.showContextMenus(evt as unknown as MouseEvent, menus)
    },
  })
})

onUnmounted(() => {
  renderer?.dispose()
})

interface CtxMenuState {
  visible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
}

const ctxMenuState = shallowReactive<CtxMenuState>({
  visible: false,
  x: 0,
  y: 0,
  items: [],
})

ws.events.on('contextmenu:changed', (state) => {
  ctxMenuState.visible = state.visible
  ctxMenuState.x = state.x
  ctxMenuState.y = state.y
  ctxMenuState.items = state.menus
})

function handleContextMenuClose() {
  ws.hideContextMenus()
}

function defaultBuildContextMenu(
  ctx: ContextMenuContext,
  w: IWorkspace,
): CoreMenuItem[] {
  switch (ctx.type) {
    case 'canvas':
      return [
        {
          label: 'Add Node',
          children: Array.from(w.nodeRegister.keys()).map((type) => ({
            label: type,
            action: () => w.addNode(type),
          })),
        },
      ]
    case 'node':
      return nodeMenu(w, ctx.nodeId!)
    case 'group':
      return groupMenu(w, ctx.groupId!)
  }
}

function nodeMenu(w: IWorkspace, nodeId: number): CoreMenuItem[] {
  return [
    {
      label: 'Delete',
      shortcut: 'Del',
      action: () => w.removeNodeByIds(nodeId),
    },
    {
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      action: () => {
        const node = w.getNode(nodeId)
        if (!node) return
        const json = node.toJSON()
        const clone = w.addNode(json.type)
        clone.fromJSON(json)
        clone.move(30, 30)
      },
    },
    {
      label: 'Add to Group',
      action: () => {
        const selected = [
          nodeId,
          ...w.state.activeIds.filter((id) => id !== nodeId),
        ]
        w.addGroup([...new Set(selected)])
      },
    },
  ]
}

function groupMenu(w: IWorkspace, groupId: number): CoreMenuItem[] {
  return [
    {
      label: 'Ungroup',
      action: () => w.removeGroup(groupId),
    },
    {
      label: 'Convert to SubGraph',
      action: () => w.covertGroupToSubGraph(groupId),
    },
    {
      label: 'Delete Group',
      shortcut: 'Del',
      action: () => w.removeGroup(groupId),
    },
  ]
}

defineExpose({
  workspace: ws,
})
</script>

<template>
  <div ref="container" class="r-konva-renderer">
    <WorkspaceToolbar v-if="props.showToolbar" />
    <ContextMenu
      v-if="props.showContextMenu"
      :visible="ctxMenuState.visible"
      :x="ctxMenuState.x"
      :y="ctxMenuState.y"
      :items="ctxMenuState.items"
      @close="handleContextMenuClose"
    />
  </div>
</template>

<style>
.r-konva-renderer {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
</style>
