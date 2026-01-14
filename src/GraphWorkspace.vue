<script setup lang="ts">
import CubicBezier from './CubicBezier.vue';
import GraphEdge from './GraphEdge.vue';
import GraphGroup from './GraphGroup.vue';
import GraphNode from './GraphNode.vue'
import { useConnectionGesture, useWorkspace } from './hooks';

const workspace = useWorkspace()!

const gesture = useConnectionGesture()!
</script>

<template>
  <div class="r-workspace">
    <GraphGroup v-for="group in workspace.groups" :key="group.id" :group-id="group.id" />
    <svg class="r-connections" xmlns="http://www.w3.org/2000/svg">
      <GraphEdge v-for="edge in workspace.edges" :key="edge.id" :edge-id="edge.id" />
      <CubicBezier v-if="gesture.state.isConnectingHandle" :start="gesture.state.start" :end="gesture.state.end" />
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
