<script setup lang="ts">
import { GraphRenderer } from '../../src';
import { setup } from './editor';

const workspace = setup()


</script>

<template>
  <GraphRenderer :workspace="workspace"></GraphRenderer>
</template>
