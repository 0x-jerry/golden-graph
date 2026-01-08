<script setup lang="ts">
import { reactive, useTemplateRef } from 'vue'
import GraphHandle from './handles/GraphHandle.vue'
import { useGraphNode } from './hooks/useGraphNode'
import { useDraggable } from '@vueuse/core'

export interface GraphNodeProps {
  nodeId: string
}

const props = defineProps<GraphNodeProps>()

const node = useGraphNode(() => props.nodeId)

const state = reactive({
  x: node.value.pos.x,
  y: node.value.pos.y,
})

const draggableEl = useTemplateRef('draggableEl')

useDraggable(draggableEl, {
  onMove(position) {
    state.x = position.x
    state.y = position.y
    node.value.moveTo(position.x, position.y)
  },
})
</script>

<template>
  <div class="r-node" :style="{ '--x': state.x + 'px', '--y': state.y + 'px' }" :node-id="node.id">
    <div class="r-node-header" ref="draggableEl">
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
</style>
