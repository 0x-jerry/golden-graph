<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import type { Workspace as IWorkspace } from '@0x-jerry/golden-graph'
import { KonvaGraphRenderer } from './renderer'
import { useContextMenuState, useWorkspace } from './hooks'
import WorkspaceToolbar from './components/WorkspaceToolbar.vue'
import ContextMenu from './components/ContextMenu.vue'

export interface KonvaRendererProps {
  setup?: (ws: IWorkspace) => void | Promise<void>
  showToolbar?: boolean
  showContextMenu?: boolean
}

const props = withDefaults(defineProps<KonvaRendererProps>(), {
  showToolbar: true,
  showContextMenu: true,
})

const containerRef = useTemplateRef<HTMLElement>('container')

const ws = useWorkspace.provide()
const ctxMenu = useContextMenuState()

let renderer: KonvaGraphRenderer | null = null

onMounted(async () => {
  const el = containerRef.value
  if (!el) return

  // Create the renderer FIRST so `workspace.setRenderer(this)` is in place
  // before `setup` runs — `setup` may call `ws.addGroup()` which requires a
  // renderer, and node/edge additions during setup are then rendered live.
  renderer = new KonvaGraphRenderer(el, ws, {
    onContextMenu: (_ctx, evt, menus) => {
      ctxMenu.show(evt.clientX, evt.clientY, menus)
    },
  })

  try {
    await props.setup?.(ws)
  } catch (error) {
    console.error('KonvaRenderer setup failed:', error)
  }
})

onBeforeUnmount(() => {
  // Dispose the renderer BEFORE the workspace: `useWorkspace.provide()`
  // registers `ws.dispose()` on `onUnmounted`, which tears down the event
  // emitter and terminates the worker — the renderer must unsubscribe from
  // the still-alive emitter first so its disposal actually runs.
  renderer?.dispose()
})

defineExpose({
  workspace: ws,
})
</script>

<template>
  <div class="r-konva-renderer-wrap">
    <div ref="container" class="r-konva-renderer"></div>
    <WorkspaceToolbar v-if="props.showToolbar" />
    <ContextMenu
      v-if="props.showContextMenu"
      :visible="ctxMenu.state.visible"
      :x="ctxMenu.state.x"
      :y="ctxMenu.state.y"
      :items="ctxMenu.state.items"
      @close="ctxMenu.hide"
    />
  </div>
</template>

<style>
.r-konva-renderer-wrap {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
.r-konva-renderer {
  width: 100%;
  height: 100%;
}
</style>
