<script lang="ts" setup>
import { computed } from 'vue'
import type { IVec2 } from './math';

export interface CubicBezierProps {
  start: IVec2
  end: IVec2
  offset: IVec2
}

const props = defineProps<CubicBezierProps>()

const d = computed(() => {
  const { start, end, offset } = props

  const s = {
    x: start.x + offset.x,
    y: start.y + offset.y,
  }

  const e = {
    x: end.x + offset.x,
    y: end.y + offset.y,
  }

  const handleOffset = 150

  return `M ${s.x} ${s.y} C ${s.x - handleOffset} ${s.y}, ${e.x + handleOffset} ${e.y}, ${e.x} ${e.y
    }`
})
</script>

<template>
  <path class="curve-path" :d="d"></path>
</template>

<style lang="less" scoped>
.curve-path {
  stroke: rgb(239, 70, 70);
  stroke-width: 3px;
  fill: transparent;
}
</style>
