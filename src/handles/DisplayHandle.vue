<script setup lang="ts">
import { useNodeHandleValue } from './useNodeHandleValue';

const value = useNodeHandleValue()
</script>

<template>
  <div class="handle-content">
    {{ value }}
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
