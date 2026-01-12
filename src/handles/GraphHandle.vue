<script lang="ts" setup>
import { useNodeHandle } from "../hooks";

export interface GraphHandle {
  handleKey: string;
}

const props = defineProps<GraphHandle>();

const handle = useNodeHandle(() => props.handleKey);
</script>

<template>
  <div
    class="r-handle"
    :class="[{ 'is-output': handle.isOutput }]"
    :handle-key="handle.key"
  >
    <template v-if="handle.isInput">
      <div class="r-joint" role="handle-joint"></div>
      <div class="r-handle-name">{{ handle.name }}</div>
    </template>
    <template v-else>
      <div class="r-handle-name">{{ handle.name }}</div>
      <div class="r-joint" role="handle-joint"></div>
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
