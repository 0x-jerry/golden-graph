<script setup lang="ts">
import GraphNode from './GraphNode.vue'
import { useGraph } from './hooks'

const graph = useGraph()!
</script>

<template>
  <div class="r-worksapce">
    <GraphNode v-for="id in graph.nodeIds" :key="id" :node-id="id" />
  </div>
</template>

<style lang="less">
.r-workspace {
  width: 100%;
  height: 100%;
}
</style>
