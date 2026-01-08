<script setup lang="ts">
import GraphHandle from './handles/GraphHandle.vue'
import { useGraphNode } from './hooks/useGraphNode'

export interface GraphNodeProps {
  nodeId: string
}

const props = defineProps<GraphNodeProps>()

const node = useGraphNode(() => props.nodeId)
</script>

<template>
  <div class="r-node" :style="{ '--x': node.pos.x + 'px', '--y': node.pos.y + 'px' }">
    <div class="r-node-header">
      <div class="r-node-title">{{ node.title }}</div>
    </div>

    <GraphHandle v-for="handle in node.getHandles()" :key="handle.id" :handle="handle" />
  </div>
</template>

<style lang="less">
.r-node {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: 200px;

  border: 1px solid #ddd;
}

.r-node-header {
  padding: 4px;
  background: #eee;
  margin-bottom: 4px;
}

.r-node-title {
}
</style>
