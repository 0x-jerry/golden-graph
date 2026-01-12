<script setup lang="ts">
import GraphNode from './GraphNode.vue'
import { useWorkspace } from './hooks';

const workspace = useWorkspace()!
</script>

<template>
  <div class="r-workspace">
    <svg class="r-connections" xmlns="http://www.w3.org/2000/svg">
      <!-- <CubicBezier v-bind="curveTest"  /> -->
    </svg>
    <GraphNode v-for="node in workspace.nodes" :key="node.id" :node-id="node.id" />
  </div>
</template>

<style lang="less">
.r-workspace {
  width: 100%;
  height: 100%;
}


.r-connections {
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
}
</style>
