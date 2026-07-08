<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import { Workspace } from './core'
import type { Workspace as IWorkspace } from './core'
import { KonvaGraphRenderer } from './renderer'

export interface KonvaRendererProps {
  setup?: (ws: IWorkspace) => void
}

const props = defineProps<KonvaRendererProps>()

const containerRef = useTemplateRef<HTMLElement>('container')

const ws = new Workspace()

let renderer: KonvaGraphRenderer | null = null

onMounted(() => {
  const el = containerRef.value
  if (!el) return

  props.setup?.(ws)
  renderer = new KonvaGraphRenderer(el, ws)
})

onUnmounted(() => {
  renderer?.dispose()
  ws.dispose()
})

defineExpose({
  workspace: ws,
})
</script>

<template>
  <div ref="container" class="r-konva-renderer"></div>
</template>

<style>
.r-konva-renderer {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
