<script setup lang="ts">
import { useClipboard, useResizeObserver } from '@vueuse/core'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  useTemplateRef,
  watch,
} from 'vue'
import { createPreview } from './createPreview'
import type { Preview } from './createPreview'
import {
  DEFAULT_SCENE_ID,
  DEFAULT_SHAPE,
  SCENES,
  SHAPES,
  readSceneId,
} from './scene-meta'
import type { PreviewShape, SceneId } from './scene-meta'

export interface WebGpuPreviewProps {
  source: string | null
}

export interface WebGpuPreviewEmits {
  /** The scene decides where the source lands, so the graph follows it. */
  'scene-change': [sceneId: SceneId]
}

type PreviewStatus = 'starting' | 'ready' | 'unsupported' | 'error'

const props = defineProps<WebGpuPreviewProps>()
const emit = defineEmits<WebGpuPreviewEmits>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const stage = useTemplateRef<HTMLElement>('stage')

const state = reactive({
  status: 'starting' as PreviewStatus,
  message: '',
  notices: [] as string[],
  sceneId: DEFAULT_SCENE_ID as SceneId,
  shape: DEFAULT_SHAPE as PreviewShape,
})

const showShape = computed(() => state.sceneId === 'material')
const sourceText = computed(() => props.source ?? '')
const { copy, copied } = useClipboard({ source: () => sourceText.value })

let preview: Preview | null = null
let appliedSource: string | null | undefined

onMounted(async () => {
  if (!('gpu' in navigator)) {
    state.status = 'unsupported'
    state.message = 'WebGPU is unavailable — this example has no WebGL fallback'
    return
  }

  try {
    preview = await createPreview(canvas.value!)
    state.status = 'ready'
    syncSize()
    applySource()
  } catch (error) {
    fail(error)
  }
})

useResizeObserver(stage, syncSize)

// `source` is owned by the workspace, so there is nothing local to call on
// change; the last value keeps unchanged re-runs from recompiling TSL.
watch(() => props.source, applySource)

onBeforeUnmount(() => {
  preview?.dispose()
  preview = null
})

function syncSize() {
  const el = stage.value

  if (preview && el) {
    preview.resize(el.clientWidth, el.clientHeight)
  }
}

function applySource() {
  if (!preview || props.source === appliedSource) {
    return
  }

  appliedSource = props.source

  try {
    state.notices = preview.apply(props.source)
  } catch (error) {
    fail(error)
    return
  }

  if (props.source) {
    state.status = 'ready'
    state.message = ''
  } else {
    state.notices = ['Wire a TSL / Output node to preview the pipeline']
  }
}

function onSceneChange(event: Event) {
  const sceneId = readSceneId((event.target as HTMLSelectElement).value)
  state.sceneId = sceneId

  // Drop the old source first: it belonged to the previous scene's graph,
  // which the app is about to rebuild.
  preview?.setScene(sceneId)
  appliedSource = undefined

  emit('scene-change', sceneId)
}

function onShapeChange(event: Event) {
  const shape = (event.target as HTMLSelectElement).value as PreviewShape
  state.shape = shape

  if (!preview) {
    return
  }

  try {
    state.notices = preview.setShape(shape)
  } catch (error) {
    fail(error)
  }
}

function fail(error: unknown) {
  state.status = 'error'
  state.message = error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <aside class="preview">
    <header class="preview-header">
      <span class="preview-title">three.js · WebGPU</span>
      <div class="preview-controls">
        <select
          class="preview-select"
          :value="state.sceneId"
          :disabled="state.status !== 'ready'"
          title="Scene"
          @change="onSceneChange"
        >
          <option v-for="scene in SCENES" :key="scene.id" :value="scene.id">
            {{ scene.label }}
          </option>
        </select>

        <select
          v-if="showShape"
          class="preview-select"
          :value="state.shape"
          :disabled="state.status !== 'ready'"
          title="Shape"
          @change="onShapeChange"
        >
          <option v-for="shape in SHAPES" :key="shape.value" :value="shape.value">
            {{ shape.label }}
          </option>
        </select>
      </div>
    </header>

    <div ref="stage" class="preview-stage">
      <canvas ref="canvas" class="preview-canvas"></canvas>
      <p v-if="state.message" class="preview-message">{{ state.message }}</p>
      <ul v-else-if="state.notices.length" class="preview-notices">
        <li v-for="(notice, index) in state.notices" :key="index">
          {{ notice }}
        </li>
      </ul>
    </div>

    <div class="preview-code">
      <div class="preview-code-head">
        <span>Generated TSL</span>
        <button type="button" class="preview-copy" @click="copy()">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <pre class="preview-source">{{
        props.source ?? '— no TSL / Output node —'
      }}</pre>
    </div>
  </aside>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 360px;
  min-height: 0;
  color: var(--gr-color-text-primary, #1f2328);
  background: var(--gr-color-bg-preview, #fafafb);
  border-left: 1px solid var(--gr-color-border, #e2e2e8);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border-bottom: 1px solid var(--gr-color-border, #e2e2e8);
}

.preview-title {
  font-size: 12px;
  color: var(--gr-color-text-muted, #5f6670);
  white-space: nowrap;
}

.preview-controls {
  display: flex;
  gap: 6px;
  min-width: 0;
}

.preview-select {
  height: 24px;
  max-width: 132px;
  padding: 0 6px;
  font-family: inherit;
  font-size: 12px;
  color: inherit;
  background: var(--gr-color-bg-input, #f6f6f8);
  border: 1px solid var(--gr-color-border, #e2e2e8);
  border-radius: 4px;
  cursor: pointer;
}

.preview-select:hover {
  background: var(--gr-color-bg-hover, rgba(0, 0, 0, 0.05));
}

.preview-stage {
  position: relative;
  aspect-ratio: 1 / 1;
  /* The WebGPU canvas clears to black, so the frame before the first render
     keeps the same dark backdrop instead of flashing a light surface. */
  background: #0d0e11;
}

.preview-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.preview-message,
.preview-notices {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  margin: 0;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1.4;
  color: #ffcc99;
  background: rgba(28, 18, 6, 0.86);
  pointer-events: none;
}

.preview-notices {
  padding-left: 24px;
}

.preview-code {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border-top: 1px solid var(--gr-color-border, #e2e2e8);
}

.preview-code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--gr-color-text-muted, #5f6670);
}

.preview-copy {
  padding: 2px 8px;
  font-size: 11px;
  color: var(--gr-color-text-primary, #1f2328);
  text-transform: none;
  background: var(--gr-color-bg-input, #f6f6f8);
  border: 1px solid var(--gr-color-border, #e2e2e8);
  border-radius: 4px;
  cursor: pointer;
}

.preview-copy:hover {
  background: var(--gr-color-bg-hover, rgba(0, 0, 0, 0.05));
}

.preview-source {
  flex: 1;
  margin: 0;
  padding: 0 12px 12px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--gr-color-text-primary, #1f2328);
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}
</style>
