<script setup lang="ts">
import type { INodeHandleConfigOptions } from '../core';
import { useHandleOptions } from './useHandleOptions';
import { useNodeHandleValue } from './useNodeHandleValue';

export interface SelectHandleOptions extends INodeHandleConfigOptions {
  options: string[];
}

const options = useHandleOptions<SelectHandleOptions>()
const value = useNodeHandleValue<string>()
</script>

<template>
  <div class="handle-content">
    <select v-model="value">
      <option v-for="(option, index) in options.options" :key="index" :value="option">
        {{ option }}
      </option>
    </select>
  </div>
</template>


<style scoped>
.handle-content {
  width: 100%;
  display: flex;
  justify-content: center;
  color: var(--gr-color-text-muted, #666);
}

select {
  width: 100%;
}
</style>
