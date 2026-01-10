<script lang="ts" setup>
import { useDraggable } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import type { IVec2 } from '../math'
import { useCoordSystem } from './hooks'

export interface GroupNodeProps {
  width: number
  height: number
  pos: IVec2

  disabled?: boolean
}

export interface GroupNodeEvents {
  moved: [offset: IVec2]
  updated: [width: number, height: number]
}

const props = defineProps<GroupNodeProps>()

const coord = useCoordSystem()!

const emit = defineEmits<GroupNodeEvents>()

const style = computed(() => {
  const { pos, width, height } = props

  return {
    '--x': `${pos.x}px`,
    '--y': `${pos.y}px`,
    '--width': `${width}px`,
    '--height': `${height}px`,
  }
})

const el = useTemplateRef('el')

useDraggable(el, {
  exact: true,
  onStart() {
    if (props.disabled) {
      return false
    }
  },
  onMove(_position, event) {
    emit('moved', {
      x: event.movementX / coord.scale,
      y: event.movementY / coord.scale,
    })
  },
})

function handleResize(evt: Event) {
  console.log('resize', evt)
}
</script>

<template>
  <div ref="el" class="group-node" :style="style" @resize="handleResize">
    <slot></slot>
  </div>
</template>

<style lang="less" scoped>
.group-node {
  pointer-events: auto;
  resize: both;
  position: absolute;
  top: 0;
  left: 0;

  translate: var(--x) var(--y);

  width: var(--width);
  height: var(--height);

  border: 1px solid rgb(176, 176, 176);
  background: #d5d5d5aa;
}
</style>
