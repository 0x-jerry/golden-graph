<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import GraphHandle from './GraphHandle.vue'
import { useCoordSystem, useNode, useWorkspace } from './hooks'

export interface GraphNodeProps {
  nodeId: number
}

const props = defineProps<GraphNodeProps>()

const node = useNode.provide(() => props.nodeId)

const ws = useWorkspace()!
const coord = useCoordSystem()!

const draggableEl = useTemplateRef('draggableEl')

useDraggable(draggableEl, {
  onMove(_, evt) {
    const pos = node.value.pos;
    const x = pos.x + evt.movementX / coord.scale
    const y = pos.y + evt.movementY / coord.scale

    node.value.moveTo(x, y)
  },
})

const classes = computed(() => {
  const clx:string[] =[]
  const executorState = ws.executorState

  if (executorState.isProcessing) {
    if (executorState.currentNodeId === node.value.id) {
      clx.push('r-node-running')
    }
  }

  return clx
})
</script>

<template>
  <div class="r-node" :class="classes" :style="{ '--x': node.pos.x + 'px', '--y': node.pos.y + 'px' }" :node-id="node.id">
    <div class="r-node-header" ref="draggableEl">
      <div class="r-node-name">{{ node.name }}</div>
    </div>

    <GraphHandle v-for="handle in node.handles" :key="handle.key" :handle-key="handle.key" />
  </div>
</template>

<style lang="less">
.r-node {
  pointer-events: auto;
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: 200px;

  border: 1px solid #ddd;

  background: white;
}

.r-node-running {
  box-shadow: 0 0 10px 2px rgb(13, 200, 13);
}

.r-node-header {
  padding: 4px;
  background: #eee;
  margin-bottom: 4px;
}
</style>
