<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { GraphRenderer, SubGraphInputNode, SubGraphOutputNode, Workspace } from '../../src'
import { setup as _setup } from './editor'

const instance = useTemplateRef<InstanceType<typeof GraphRenderer>>('renderer')

const cacheKey = 'graph-save-data'

const workspace = computed(() => instance.value?.workspace);

function setup(ws: Workspace) {
  _setup(ws)
  ws.setDebug(true)

  ws.registerNode(SubGraphInputNode.type, SubGraphInputNode)
  ws.registerNode(SubGraphOutputNode.type, SubGraphOutputNode)

  const events = ['handle:updated', 'edge:added', 'edge:removed'] as const

  let isPending = false

  events.forEach(event => {
    ws.events.on(event, () => {
      execute()
    })
  })

  async function execute() {
    if (ws.executorState.isProcessing) {
      isPending = true
      return
    }

    await ws.execute()

    if (isPending) {
      isPending = false
      execute()
    }
  }
}

function save() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  while (ws.isActiveSubGraph) {
    ws.exitSubGraph()
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

async function loadFromJSON() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  const json = window.prompt('Input JSON String')

  const data = JSON.parse(json || '')

  ws.clear()

  await nextTick()
  ws.fromJSON(data)
}
</script>

<template>
  <div class="full-screen">
    <div class="tools">
      <button @click="clear">Clear</button>
      <button @click="save">Save</button>
      <button @click="load">Load</button>
      <button @click="loadFromJSON">Load From JSON</button>
      <button @click="workspace?.setDebug(!workspace?.state.debug)">Debug: {{ workspace?.state.debug }}</button>
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
