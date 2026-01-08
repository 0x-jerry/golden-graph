<script setup lang="ts">
import { GraphRenderer } from '../../src'
import { setup } from './editor'

const workspace = setup()
</script>

<template>
  <div class="full-screen">
    <GraphRenderer :workspace="workspace" />
  </div>
</template>

<style>
.full-screen {
  width: 100vw;
  height: 99vh;
  padding: 20px;
}
</style>
