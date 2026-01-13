<script setup lang="ts">
import { useNodeHandle } from '../hooks';
import { useNodeHandleValue } from './useNodeHandleValue';

const handle = useNodeHandle()!

const value = useNodeHandleValue<number>()
</script>

<template>
  <div class="handle-content">
    <input class="number-input" type="number" v-model.number="value">
    <div>
      {{ handle.name }}
    </div>
  </div>
</template>


<style>
.handle-content {
  width: 100%;
  display: flex;
  gap: 4px;

  input {
    flex: 1;
    width: 0;
  }
}
</style>
