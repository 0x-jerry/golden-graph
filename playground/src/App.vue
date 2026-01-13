<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { GraphRenderer } from '../../src'
import { setup } from './editor'

const instance = useTemplateRef<InstanceType<typeof GraphRenderer>>('renderer')

const cacheKey = 'graph-save-data'

function save() {
  const ws = instance.value?.workspace
  if (!ws) {
    return
  }

  const data = ws.toJSON()

  localStorage.setItem(cacheKey, JSON.stringify(data));
}

function load() {
  const ws = instance.value?.workspace
  if (!ws) {
    return
  }
  const data = localStorage.getItem(cacheKey);
  if (!data) {
    return
  }

  ws.fromJSON(JSON.parse(data))
}

</script>

<template>
  <div class="full-screen">
    <div class="tools">
      <button @click="save">Save</button>
      <button @click="load">Load</button>
    </div>

    <div class="graph-render-content">
      <GraphRenderer ref="renderer" :setup="setup" />
    </div>
  </div>
</template>

<style>
.full-screen {
  display: flex;
  flex-direction: column;

  width: 100vw;
  height: 100vh;
}

.tools {
  height: 50px;
  display: flex;
  padding: 0 20px;
  gap: 8px;
}

.graph-render-content {
  flex: 1;
  height: 0;
}
</style>
