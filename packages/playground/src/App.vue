<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import { Workspace } from '@0x-jerry/golden-graph'
import { KonvaRenderer } from '@0x-jerry/golden-graph-renderer'
import { setup as _setup } from './editor'

const instance = useTemplateRef<InstanceType<typeof KonvaRenderer>>('renderer')

const cacheKey = 'graph-save-data'

const workspace = computed(() => instance.value?.workspace)

async function setup(ws: Workspace) {
  await _setup(ws)
  ws.setDebug(true)

  const events = ['handle:updated', 'edge:added', 'edge:removed'] as const

  let isPending = false
  let isExecuting = false
  let isScheduled = false

  events.forEach((event) => {
    ws.events.on(event, () => {
      // Values written back by the executor while a run is in progress must
      // not schedule another run — otherwise non-idempotent graphs (random
      // values, clocks, ...) re-trigger execution forever.
      if (ws.executorState.isProcessing) {
        return
      }

      isPending = true

      // Defer the run to the next task instead of executing synchronously
      // inside the event handler. Mutations applied in the same synchronous
      // block (e.g. `clear()` + `fromJSON()` in `load()`) must all be
      // visible before the workspace snapshot is taken — otherwise the run
      // would execute a partial graph and its handle write-backs could
      // overwrite the freshly loaded data.
      if (!isExecuting && !isScheduled) {
        isScheduled = true

        setTimeout(() => {
          isScheduled = false
          void execute()
        }, 0)
      }
    })
  })

  async function execute() {
    if (isExecuting) {
      isPending = true
      return
    }

    isExecuting = true
    isPending = false

    try {
      await ws.execute()
    } catch (error) {
      console.error('Workspace execution failed:', error)
    } finally {
      isExecuting = false
    }

    if (isPending) {
      void execute()
    }
  }
}

function save() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  const data = ws.toFullJSON()

  localStorage.setItem(cacheKey, JSON.stringify(data))
}

async function load() {
  const ws = workspace.value
  if (!ws) {
    return
  }
  const data = localStorage.getItem(cacheKey)
  if (!data) {
    return
  }

  // Mirror `save()`: the saved data is always the top-level graph, so exit
  // any active subgraph before replacing the workspace content.
  while (ws.isActiveSubGraph) {
    ws.exitSubGraph()
  }

  try {
    ws.clear()

    await nextTick()
    ws.fromJSON(JSON.parse(data))
  } catch (error) {
    console.error('Failed to load workspace from storage:', error)
  }
}

function clear() {
  workspace.value?.clear()
}

async function run() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  try {
    await ws.execute()
  } catch (error) {
    console.error('Workspace execution failed:', error)
  }
}

async function loadFromJSON() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  const json = window.prompt('Input JSON String')
  if (!json) {
    return
  }

  try {
    const data = JSON.parse(json)

    ws.clear()

    await nextTick()
    ws.fromJSON(data)
  } catch (error) {
    console.error('Failed to load workspace from JSON:', error)
  }
}
</script>

<template>
  <div class="full-screen">
    <div class="tools">
      <button @click="clear">Clear</button>
      <button @click="save">Save</button>
      <button @click="load">Load</button>
      <button @click="loadFromJSON">Load From JSON</button>
      <button @click="workspace?.setDebug(!workspace?.state.debug)">
        Debug: {{ workspace?.state.debug }}
      </button>
      <button :disabled="workspace?.executorState.isProcessing" @click="run">
        Run
      </button>
    </div>

    <div class="graph-render-content">
      <KonvaRenderer ref="renderer" :setup="setup" />
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
  border: 0 solid #eee;
  border-width: 0 0 1px 0;

  gap: 8px;
}

.graph-render-content {
  flex: 1;
  height: 0;
}
</style>
