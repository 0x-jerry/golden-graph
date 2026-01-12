<script setup lang="ts">
import { GraphRenderer } from '../../src'
import { setup } from './editor'

</script>

<template>
  <div class="full-screen">
    <GraphRenderer :setup="setup" />
  </div>
</template>

<style>
.full-screen {
  width: 100vw;
  height: 99vh;
  padding: 20px;
}
</style>
