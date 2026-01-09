<script lang="ts" setup>
import { useDraggable } from '@vueuse/core'
import { useTemplateRef } from 'vue'
import type { Vec2 } from './types'
import { useCoordSystem } from './useCoordSystem'

export interface TestNodeProps {
  disabled?: boolean
}

export interface TestNodeEvents {
  moved: []
}

const props = defineProps<TestNodeProps>()
const emit = defineEmits<TestNodeEvents>()

const coord = useCoordSystem()!

const value = defineModel<Vec2>({ default: { x: 0, y: 0 } })

const el = useTemplateRef('el')

useDraggable(el, {
  onStart() {
    if (props.disabled) {
      return false
    }
  },
  onMove(_position, event) {
    value.value.x += event.movementX / coord.scale
    value.value.y += event.movementY / coord.scale

    emit('moved')
  },
})
</script>

<template>
  <div
    ref="el"
    class="test-node"
    :aria-disabled="disabled"
    :data-x="value.x"
    :data-y="value.y"
    :style="{ '--x': value.x + 'px', '--y': value.y + 'px', '--scale': 1 }"
  >
    <slot></slot>
  </div>
</template>

<style lang="less" scoped>
.test-node {
  pointer-events: auto;
  position: absolute;
  left: 0;
  top: 0;

  translate: var(--x) var(--y);
  scale: var(--scale);
  transform-origin: top left;

  &[aria-disabled='true'] {
    pointer-events: none;
  }
}
</style>
