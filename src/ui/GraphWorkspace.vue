<script setup lang="ts">
import GraphNode from './GraphNode.vue'
import { useGraph } from './hooks'

const graph = useGraph()!
</script>

<template>
  <div class="r-workspace">
    <svg class="r-connections" xmlns="http://www.w3.org/2000/svg">
      <!-- <CubicBezier v-bind="curveTest" :offset="{ x: 50000, y: 50000 }" /> -->
    </svg>
    <GraphNode v-for="id in graph.nodeIds" :key="id" :node-id="id" />
  </div>
</template>

<style lang="less">
.r-workspace {
  width: 100%;
  height: 100%;
}


.r-connections {
  pointer-events: none;
  position: relative;

  width: 100000px;
  height: 100000px;
  left: -50000px;
  top: -50000px;
}
</style>
