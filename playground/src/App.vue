<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue';
import { GraphRenderer } from '../../src'
import { Executor } from '../../src/core';
import { setup } from './editor'

const instance = useTemplateRef('renderer')

const cacheKey = 'graph-save-data'

function save() {
  const ws = instance.value?.workspace
  if (!ws) {
    return
  }

  const data = ws.toJSON()

  localStorage.setItem(cacheKey, JSON.stringify(data));
}

async function load() {
  const ws = instance.value?.workspace
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
  instance.value?.workspace.clear()
}

function run() {
  const ws = instance.value?.workspace
  if (!ws) {
    return
  }

  const nodes = ws.nodes.filter(n => n.type === 'Number')

  new Executor(ws).execute(nodes.map(n => n.id))
}
</script>

<template>
  <div class="full-screen">
    <div class="tools">
      <button @click="clear">Clear</button>
      <button @click="save">Save</button>
      <button @click="load">Load</button>
      <button @click="run">Run</button>
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
