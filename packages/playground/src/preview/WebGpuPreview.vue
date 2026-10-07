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
import type { Preview, PreviewShape } from './createPreview'

export interface WebGpuPreviewProps {
  code: string | null
}

type PreviewStatus = 'starting' | 'ready' | 'unsupported' | 'error'

const props = defineProps<WebGpuPreviewProps>()

const SHAPES: { value: PreviewShape; label: string }[] = [
  { value: 'plane', label: 'Plane' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'torus', label: 'Torus knot' },
]

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const stage = useTemplateRef<HTMLElement>('stage')
const { copy, copied } = useClipboard({ source: () => props.code ?? '' })

const state = reactive({
  status: 'starting' as PreviewStatus,
  message: '',
  shape: 'plane' as PreviewShape,
})

const message = computed(() => {
  if (state.message) {
    return state.message
  }

  return state.status === 'starting' ? 'Starting WebGPU…' : ''
})

let preview: Preview | null = null

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
    applyCode()
  } catch (error) {
    fail(error)
  }
})

useResizeObserver(stage, syncSize)

watch(() => props.code, applyCode)

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

function applyCode() {
  if (!preview) {
    return
  }

  if (!props.code) {
    state.message = 'Wire a TSL / Output node to preview the pipeline'
    return
  }

  try {
    preview.setShader(props.code)
    state.status = 'ready'
    state.message = ''
  } catch (error) {
    fail(error)
  }
}

function onShapeChange(event: Event) {
  const shape = (event.target as HTMLSelectElement).value as PreviewShape

  state.shape = shape
  preview?.setShape(shape)
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
      <select
        class="preview-shape"
        :value="state.shape"
        :disabled="state.status !== 'ready'"
        @change="onShapeChange"
      >
        <option v-for="shape in SHAPES" :key="shape.value" :value="shape.value">
          {{ shape.label }}
        </option>
      </select>
    </header>

    <div ref="stage" class="preview-stage">
      <canvas ref="canvas" class="preview-canvas"></canvas>
      <p v-if="message" class="preview-message">{{ message }}</p>
    </div>

    <div class="preview-code">
      <div class="preview-code-head">
        <span>Generated TSL</span>
        <button type="button" class="preview-copy" @click="copy()">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <pre class="preview-source">{{
        props.code ?? '— no TSL / Output node —'
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
  color: #e6e6ea;
  background: #17181c;
  border-left: 1px solid #1c1c1e;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border-bottom: 1px solid #26282e;
}

.preview-title {
  font-size: 12px;
  color: #c9cbd4;
}

.preview-shape {
  height: 24px;
  padding: 0 6px;
  font-size: 12px;
  color: inherit;
  background: #24262c;
  border: 1px solid #34373f;
  border-radius: 4px;
}

.preview-stage {
  position: relative;
  aspect-ratio: 1 / 1;
  background: #0d0e11;
}

.preview-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.preview-message {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1.4;
  color: #ffcc99;
  background: rgba(28, 18, 6, 0.86);
}

.preview-code {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border-top: 1px solid #26282e;
}

.preview-code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8f93a0;
}

.preview-copy {
  padding: 2px 8px;
  font-size: 11px;
  color: #c9cbd4;
  text-transform: none;
  background: #24262c;
  border: 1px solid #34373f;
  border-radius: 4px;
  cursor: pointer;
}

.preview-source {
  flex: 1;
  margin: 0;
  padding: 0 12px 12px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #9be49b;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}
</style>
