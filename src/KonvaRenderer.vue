<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import type { Workspace as IWorkspace } from './core'
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

onMounted(() => {
  const el = containerRef.value
  if (!el) return

  props.setup?.(ws)

  renderer = new KonvaGraphRenderer(el, ws, {
    onContextMenu: (_ctx, evt, menus) => {
      ctxMenu.show(evt.clientX, evt.clientY, menus)
    },
  })
})

onUnmounted(() => {
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
