<script setup lang="ts">
import { useNodeHandle, useWorkspace } from '../hooks';
import { useNodeHandleValue } from './useNodeHandleValue';

const ws = useWorkspace()!
const handle = useNodeHandle()!

const value = useNodeHandleValue()

</script>

<template>
  <div>
    {{ handle?.name }}
    <template v-if="ws.state.debug">
      : {{ value }}
    </template>
  </div>
</template>

<style scoped></style>
