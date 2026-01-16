<script lang="ts" setup>
import { useDraggable } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { ActiveType, type IVec2 } from './core'
import { useCoordSystem, useGroup, useWorkspace } from './hooks'

export interface GroupNodeProps {
  groupId: number
}

export interface GroupNodeEvents {
  moved: [offset: IVec2]
  updated: [width: number, height: number]
}

const props = defineProps<GroupNodeProps>()

const ws = useWorkspace()!
const coord = useCoordSystem()!
const group = useGroup.provide(() => props.groupId)

const emit = defineEmits<GroupNodeEvents>()

const style = computed(() => {
  const { pos, size } = group.value

  return {
    '--x': `${pos.x}px`,
    '--y': `${pos.y}px`,
    '--width': `${size.x}px`,
    '--height': `${size.y}px`,
  }
})

const headerEl = useTemplateRef('header-el')
const groupNodeEl = useTemplateRef('group-node')

const ContextMenus = [
  {
    label: 'Delete Group',
    action: () => {
      ws.removeGroup(props.groupId)
    },
  },
]

useDraggable(headerEl, {
  exact: true,
  onStart() {
    if (ws.disabled) {
      return false
    }
  },
  onMove(_position, event) {
    const pos = {
      x: event.movementX / coord.scale,
      y: event.movementY / coord.scale,
    }

    group.value.move(pos)
  },
})

useDraggable(groupNodeEl, {
  exact: true,
  onMove(_position, event) {
    coord.move(event.movementX, event.movementY)
  },
})

function handleResize(evt: Event) {
  console.log('resize', evt)
}

function handleContextMenu(evt: MouseEvent) {
  ws.showContextMenus(evt, ContextMenus)
}
</script>

<template>
  <div class="group-node" :class="{'group-node-active': ws.isActive(group.id)}" ref="group-node" :style="style" @resize="handleResize" @contextmenu="handleContextMenu"
    @pointerdown.stop="ws.setActiveIds(ActiveType.Group, group.id)">
    <div ref="header-el" class="group-header">
      {{ group.name }}
    </div>
    <slot></slot>
  </div>
</template>

<style lang="less" scoped>
.group-node {
  position: absolute;
  top: 0;
  left: 0;

  translate: var(--x) var(--y);

  width: var(--width);
  height: var(--height);

  border: 1px solid var(--gr-color-border, rgb(176, 176, 176));
  background: var(--gr-color-surface, #d5d5d5aa);
  color: var(--gr-color-text-primary, #000000);

  .group-header {
    pointer-events: auto;
    background: var(--gr-color-surface-header, rgba(0, 0, 0, 0.15));
    padding: 8px;
  }
}

.group-node-active {
  border-color: var(--gr-color-accent, #007acc);
}
</style>
