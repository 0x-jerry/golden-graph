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


<style scoped>
.handle-content {
  width: 100%;
  text-align: center;
  color: var(--gr-color-text-muted, #666);
}
</style>
