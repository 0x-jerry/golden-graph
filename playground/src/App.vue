<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { GraphRenderer } from '../../src'
import { setup } from './editor'

const instance = useTemplateRef<InstanceType<typeof GraphRenderer>>('renderer')

const cacheKey = 'graph-save-data'

const workspace = computed(() => instance.value?.workspace);

function save() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  const data = ws.toJSON()

  localStorage.setItem(cacheKey, JSON.stringify(data));
}

async function load() {
  const ws = workspace.value
  if (!ws) {
    return
  }
  const data = localStorage.getItem(cacheKey);
  if (!data) {
    return
  }


  ws.clear()

  await nextTick()
  ws.fromJSON(JSON.parse(data))

  console.log(ws)
}

function clear() {
  workspace.value?.clear()
}

async function run() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  await ws.execute()
}
</script>

<template>
  <div class="full-screen">
    <div class="tools">
      <button @click="clear">Clear</button>
      <button @click="save">Save</button>
      <button @click="load">Load</button>
      <button :disabled="workspace?.executorState.isProcessing" @click="run">Run</button>
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
  align-items: center;

  gap: 8px;
}

.graph-render-content {
  flex: 1;
  height: 0;
}
</style>
