<script setup lang="ts">
import type { GWorkspace } from './core'
import CoordSystem from './CoordSystem.vue';
import GraphWorkspace from './GraphWorkspace.vue'
import { useGraph } from './hooks'

export interface GraphRendererProps {
  workspace: GWorkspace
}

const props = defineProps<GraphRendererProps>()

useGraph.provide({
  workspace: props.workspace,
})
</script>

<template>
  <div class="r-renderer">
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
