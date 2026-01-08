<script setup lang="ts">
import type { GWorksapce } from '../core'
import GraphWorkspace from './GraphWorkspace.vue'
import { useGraph } from './hooks'

export interface GraphRendererProps {
  workspace: GWorksapce
}

const props = defineProps<GraphRendererProps>()

useGraph.provide({
  workspace: props.workspace,
})
</script>

<template>
  <div class="r-renderer">
    <GraphWorkspace></GraphWorkspace>
  </div>
</template>

<style lang="less">
.r-renderer {
  width: 100%;
  height: 100%;
}
</style>
