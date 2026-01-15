<script setup lang="ts">
import type { INodeHandleConfigOptions } from '../core';
import { useHandleOptions } from './useHandleOptions';

export interface TextHandleOptions extends INodeHandleConfigOptions {
  content?: string;
}

const options = useHandleOptions<TextHandleOptions>()
</script>

<template>
  <div class="handle-content">
    {{ options.content }}
  </div>
</template>


<style>
.handle-content {
  width: 100%;
  text-align: center;
  color: var(--gr-color-text-muted, #666);
  margin: 8px 0;
}
</style>
