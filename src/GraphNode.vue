<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import type { ContextMenuItem } from './components/ContextMenu.vue'
import { ActiveType } from './core'
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

const ContextMenus: ContextMenuItem[] = [
  {
    label: 'Delete Node',
    action: () => {
      ws.removeNodeByIds(props.nodeId)
    },
  },
  {
    label: 'Copy Node',
    action: () => {
      const data = node.value.toJSON()

      ws.addNode(data.type, {
        data: data.data,
        pos: {
          x: data.pos.x + 20,
          y: data.pos.y + 20,
        }
      })
    },
  },
  {
    label: 'Create Group',
    action: () => {
      ws.addGroup(ws.state.activeIds)
    }
  }
]

const classes = computed(() => {
  const clx:string[] =[]
  const executorState = ws.executorState

  if (ws.isActive(node.value.id)) {
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

    ws.moveActiveNodes({ x, y })
  },
})


function handleContextMenu(evt: MouseEvent) {
  ws.showContextMenus(evt, ContextMenus)
}
</script>

<template>
  <div class="r-node" :class="classes" :style="{ '--x': node.pos.x + 'px', '--y': node.pos.y + 'px' }" :node-id="node.id"
  @pointerdown.stop="ws.setActiveIds(ActiveType.Node, node.id)"
  @contextmenu.stop="handleContextMenu"
  >
    <div class="r-node-header" ref="draggableEl">
      <div class="r-node-name">
        {{ node.name }}
        <template v-if="ws.state.debug">({{ node.id }})</template>
      </div>
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

  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 8px;
}

.r-node-active {
  border-color: var(--gr-color-accent, #007acc);
}

.r-node-running {
  box-shadow: 0 0 10px 2px var(--gr-color-accent-soft, rgb(13, 200, 13));
}

.r-node-header {
  padding: 4px 8px;
  background: var(--gr-color-surface-header, #eee);
}
</style>
