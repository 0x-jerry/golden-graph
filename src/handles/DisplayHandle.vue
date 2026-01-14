<script setup lang="ts">
import { computed, toRaw } from 'vue';
import { useNodeHandleValue } from './useNodeHandleValue';

const value = useNodeHandleValue()

const str = computed(() => JSON.stringify(toRaw(value.value), null, 2))
</script>

<template>
  <div class="handle-content">
    {{ str }}
  </div>
</template>


<style>
.handle-content {
  width: 100%;
  text-align: center;
  color: #666;
  margin: 8px 0;
}
</style>
