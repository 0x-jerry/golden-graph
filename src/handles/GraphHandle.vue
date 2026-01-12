<script lang="ts" setup>
import type { GHandle } from '../../core'

export interface GraphHandle {
  handle: GHandle
}

const props = defineProps<GraphHandle>()
</script>

<template>
  <div class="r-handle" :class="[{ 'is-output': handle.isOutput }]" :handle-key="handle.id">
    <template v-if="handle.isInput">
      <div class="r-joint"></div>
      <div class="r-handle-name">{{ handle.name }}</div>
    </template>
    <template v-else>
      <div class="r-handle-name">{{ handle.name }}</div>
      <div class="r-joint"></div>
    </template>
  </div>
</template>

<style lang="less">
.r-joint {
  position: relative;
  --size: 10px;

  left: calc(-1 * var(--size) / 2);

  width: var(--size);
  height: var(--size);
  border-radius: var(--size);

  background: red;
}

.r-handle {
  display: flex;
  align-items: center;
  gap: 4px;

  height: 24px;

  &.is-output {
    justify-content: flex-end;

    .r-joint {
      left: unset;
      right: calc(-1 * var(--size) / 2);
    }
  }
}
</style>
