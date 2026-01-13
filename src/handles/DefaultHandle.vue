<script setup lang="ts">
import { useNodeHandle } from '../hooks';

const handle = useNodeHandle()!
</script>

<template>
  <div>
    {{ handle?.name }}
  </div>
</template>
