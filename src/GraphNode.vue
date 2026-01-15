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

const ContextMenus = [
  {
    label: 'Delete Node',
    action: () => {
      ws.removeNodeByIds(props.nodeId)
    },
  },
]

const classes = computed(() => {
  const clx:string[] =[]
  const executorState = ws.executorState

  if (ws.state.activeId === node.value.id) {
    clx.push('r-node-active')
  }

  if (executorState.isProcessing) {
    if (executorState.currentNodeId === node.value.id) {
      clx.push('r-node-running')
    }
  }

  return clx
})

useDraggable(draggableEl, {
  onMove(_, evt) {
    const x = evt.movementX / coord.scale
    const y = evt.movementY / coord.scale

    node.value.move(x, y)
  },
})


function handleContextMenu(evt: MouseEvent) {
  ws.showContextMenus(evt, ContextMenus)
}
</script>

<template>
  <div class="r-node" :class="classes" :style="{ '--x': node.pos.x + 'px', '--y': node.pos.y + 'px' }" :node-id="node.id"
  @pointerdown.stop="ws.setActiveId(node.id)"
  @contextmenu.stop="handleContextMenu"
  >
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
  border: 1px solid var(--gr-color-border, #ddd);
  background: var(--gr-color-surface, #ffffff);
  color: var(--gr-color-text-primary, #000000);
  border-radius: var(--gr-size-node-radius, 0);
}

.r-node-active {
  border-color: var(--gr-color-accent, #007acc);
}

.r-node-running {
  box-shadow: 0 0 10px 2px var(--gr-color-accent-soft, rgb(13, 200, 13));
}

.r-node-header {
  padding: 4px;
  background: var(--gr-color-surface-header, #eee);
  margin-bottom: 4px;
}
</style>
