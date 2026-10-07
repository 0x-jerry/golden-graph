<script setup lang="ts">
import { computed, nextTick, reactive, ref, useTemplateRef } from 'vue'
import { isCancelledError, Workspace } from '@0x-jerry/golden-graph'
import { KonvaRenderer } from '@0x-jerry/golden-graph-renderer'
import type { DeepPartial, GraphTheme } from '@0x-jerry/golden-graph-renderer'
import { setup as _setup } from './editor'
import { buildSceneExample } from './examples'
import { readTslSource } from './nodes/tsl'
import type { SceneId } from './preview/scene-meta'
import WebGpuPreview from './preview/WebGpuPreview.vue'

const instance = useTemplateRef<InstanceType<typeof KonvaRenderer>>('renderer')

const cacheKey = 'tsl-graph-save-data'

/**
 * Blender-style dark palette. Layered over `DEFAULT_THEME`, so every token
 * that paints a light surface has to be mirrored here — a missing one falls
 * back to the paper-print value (near-black text on a dark band).
 */
const DARK_THEME: DeepPartial<GraphTheme> = {
  colors: {
    bg: '#2b2b2b',
    border: '#151515',
    headerBg: '#3b3b3b',
    headerText: '#e8e8e8',
    headerDivider: '#151515',
    textPrimary: '#e8e8e8',
    textLabel: '#c8c8c8',
    textMuted: '#9a9a9a',
    accent: '#ff8c2b',
    accentSoft: 'rgba(255, 140, 43, 0.3)',
    jointDefault: '#8a8a8a',
    jointHighlight: '#ff8c2b',
    subgraphTagBg: '#4a3a28',
    subgraphTagText: '#ffb066',
    edge: 'rgba(180, 180, 180, 0.55)',
    groupBg: 'rgba(255, 255, 255, 0.04)',
    groupBorder: 'rgba(255, 255, 255, 0.18)',
    groupHeaderBg: 'rgba(255, 255, 255, 0.07)',
    gridColor: '#2a2a2a',
    surface: '#2b2b2b',
    bgToolbar: 'rgba(43, 43, 43, 0.92)',
    bgHover: 'rgba(255, 255, 255, 0.08)',
    bgInput: '#3b3b3b',
    bgPreview: '#242424',
  },
  metrics: {
    nodeCornerRadius: 4,
    groupCornerRadius: 4,
    edgeWidth: 2,
  },
}

const themeName = ref<'light' | 'dark'>('light')
const theme = computed<DeepPartial<GraphTheme>>(() =>
  themeName.value === 'dark' ? DARK_THEME : {},
)

// Workspace/executor state is plain, non-reactive data driven by the
// event bus — mirror the events into a reactive state object so the
// toolbar's Run ⇄ Cancel button and Debug flag re-render.
const uiState = reactive({
  isProcessing: false,
  debug: false,
})

const shaderSource = ref<string | null>(null)

const workspace = computed(() => instance.value?.workspace)

async function setup(ws: Workspace) {
  await _setup(ws)

  // Debug pacing (100ms per node) would delay every live preview update.
  ws.setDebug(false)

  ws.events.on('executor:changed', (state) => {
    uiState.isProcessing = state.isProcessing
  })

  uiState.debug = ws.state.debug
  ws.events.on('state:changed', (state) => {
    uiState.debug = state.debug
  })

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
      // Cancelling is a deliberate user action, not a failure.
      if (isCancelledError(error)) {
        return
      }

      console.error('Workspace execution failed:', error)
    } finally {
      isExecuting = false
      refreshSource(ws)
    }

    if (isPending) {
      void execute()
    }
  }

  refreshSource(ws)
  void execute()
}

/**
 * Read the source the executor generated into the Output node. Inside a
 * subgraph the top-level Output is not in the active workspace, so the preview
 * keeps the last compiled source.
 */
function refreshSource(ws: Workspace) {
  if (ws.isActiveSubGraph) {
    return
  }

  shaderSource.value = readTslSource(ws)
}

function save() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  const data = ws.toFullJSON()

  localStorage.setItem(cacheKey, JSON.stringify(data))
}

/**
 * Replace the whole workspace content with whatever `build` adds. Any active
 * subgraph must be exited first — `clear()` intentionally leaves
 * `_workspaceDataStack` untouched, and a stale snapshot would corrupt the next
 * `save()` (its `exitSubGraph()` pops a stack entry that no longer matches the
 * workspace).
 *
 * The `clear()` + `nextTick()` ordering matters: the renderer has to drop the
 * old node views before new ids are added, and the graph must be complete
 * before the run scheduled by its own events takes a snapshot.
 */
async function resetGraph(build: (ws: Workspace) => void) {
  const ws = workspace.value
  if (!ws) {
    return
  }

  while (ws.isActiveSubGraph) {
    ws.exitSubGraph()
  }

  try {
    ws.clear()

    await nextTick()
    build(ws)
  } catch (error) {
    console.error('Failed to reset workspace:', error)
  }

  refreshSource(ws)
}

async function replaceGraph(data: Parameters<Workspace['fromJSON']>[0]) {
  await resetGraph((ws) => ws.fromJSON(data))
}

/** A scene switch swaps the graph for that scene's default example. */
async function loadSceneExample(sceneId: SceneId) {
  await resetGraph((ws) => buildSceneExample(ws, sceneId))
}

async function load() {
  const data = localStorage.getItem(cacheKey)
  if (!data) {
    return
  }

  await replaceGraph(JSON.parse(data) as Parameters<Workspace['fromJSON']>[0])
}

function clear() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  ws.clear()
  refreshSource(ws)
}

async function run() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  try {
    await ws.execute()
  } catch (error) {
    // Cancelling is a deliberate user action, not a failure.
    if (isCancelledError(error)) {
      return
    }

    console.error('Workspace execution failed:', error)
  } finally {
    refreshSource(ws)
  }
}

function cancel() {
  const ws = workspace.value
  if (!ws) {
    return
  }

  // Fire-and-forget: the run settles on its own and the button flips back
  // via `executor:changed`.
  ws.cancel()
}

async function loadFromJSON() {
  const json = window.prompt('Input JSON String')
  if (!json) {
    return
  }

  await replaceGraph(JSON.parse(json) as Parameters<Workspace['fromJSON']>[0])
}
</script>

<template>
  <div class="full-screen">
    <div class="tools">
      <button @click="clear">Clear</button>
      <button @click="save">Save</button>
      <button @click="load">Load</button>
      <button @click="loadFromJSON">Load From JSON</button>
      <button @click="workspace?.setDebug(!uiState.debug)">
        Debug: {{ uiState.debug }}
      </button>
      <button @click="uiState.isProcessing ? cancel() : run()">
        {{ uiState.isProcessing ? 'Cancel' : 'Run' }}
      </button>
      <select v-model="themeName" title="Theme">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>

    <div class="body">
      <div class="graph-render-content">
        <KonvaRenderer ref="renderer" :setup="setup" :theme="theme" />
      </div>

      <WebGpuPreview
        :source="shaderSource"
        @scene-change="loadSceneExample"
      />
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

.body {
  display: flex;
  flex: 1;
  height: 0;
}

.graph-render-content {
  flex: 1;
  min-width: 0;
  height: 100%;
}
</style>
