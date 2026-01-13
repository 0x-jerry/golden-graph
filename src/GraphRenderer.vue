<script setup lang="ts">
import CoordSystem from './CoordSystem.vue';
import type { Workspace } from './core';
import GraphWorkspace from './GraphWorkspace.vue'
import { useWorkspace } from './hooks';
import { useConnectionGesture } from './hooks/useConnectionGesture';

export interface GraphRendererProps {
  setup?: (workspace: Workspace) => void
}

const props = defineProps<GraphRendererProps>()

const ws = useWorkspace.provide()

useConnectionGesture.provide({
  workspace: ws
})

props.setup?.(ws)

defineExpose({
  workspace: ws
})
</script>

<template>
  <div class="r-renderer" :workspace-id="ws.id">
    <CoordSystem>
      <GraphWorkspace></GraphWorkspace>
    </CoordSystem>
  </div>
</template>

<style lang="less">
.r-renderer {
  width: 100%;
  height: 100%;

  user-select: none;
}
</style>
