<script setup lang="ts">
import type { INodeHandleConfigOptions } from '../core';
import { useHandleOptions } from './useHandleOptions';

export interface TextHandleProps extends INodeHandleConfigOptions {
  content?: string;
}

const options = useHandleOptions<TextHandleProps>()
</script>

<template>
  <div class="text-handle">
    {{ options.content }}
  </div>
</template>


<style>
.text-handle {
  width: 100%;
  text-align: center;
  color: #666;
  margin: 8px 0;
}
</style>
