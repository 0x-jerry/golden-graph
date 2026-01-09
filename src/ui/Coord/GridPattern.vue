<script lang="ts" setup>
import { useCoordSystem } from './useCoordSystem'

const coord = useCoordSystem()!
</script>

<template>
  <div class="grid-pattern" :style="coord.getCoordStyle({ x: 0, y: 0 })" />
</template>

<style lang="less" scoped>
.grid-pattern {
  width: 100%;
  height: 100%;
  pointer-events: none;

  --color: #eee;

  --size: calc(80px * var(--scale));

  background-position: var(--x) var(--y);

  background-image: linear-gradient(to right, var(--color) 1px, transparent 1px),
    linear-gradient(to bottom, var(--color) 1px, transparent 1px);

  background-size: var(--size) var(--size);
}
</style>
