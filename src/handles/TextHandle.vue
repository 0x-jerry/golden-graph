<script setup lang="ts">
import type { INodeHandleConfigOptions } from '../core';
import { useHandleOptions } from './useHandleOptions';

export interface TextHandleProps extends INodeHandleConfigOptions {
  content?: string;
}

const options = useHandleOptions<TextHandleProps>()
</script>

<template>
  <div>
    {{ options.content }}
  </div>
</template>
