<script lang="ts" setup>
import { useDraggable } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import type { IVec2 } from './core'
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

const el = useTemplateRef('el')

useDraggable(el, {
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

function handleResize(evt: Event) {
  console.log('resize', evt)
}
</script>

<template>
  <div class="group-node" :style="style" @resize="handleResize">
    <div ref="el" class="group-header">
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

  border: 1px solid rgb(176, 176, 176);
  background: #d5d5d5aa;

  .group-header {
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.15);
    padding: 8px;
  }
}
</style>
