<script setup lang="ts">
import Konva from 'konva'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Workspace } from '@0x-jerry/golden-graph'
import { NodeView, getNodeHeight } from '../renderer/NodeView'
import { getNodeWidth } from '../renderer/constants'

export interface NodePreviewProps {
  ws: Workspace
  type?: string
}

const props = defineProps<NodePreviewProps>()

const container = ref<HTMLDivElement>()

let stage: Konva.Stage | null = null
let view: NodeView | null = null

/**
 * Render the node of `props.type` as it would appear in the graph, using a
 * temporary node that is never added to the workspace.
 */
async function render() {
  await nextTick()
  const el = container.value
  if (!el) return

  destroy()

  if (!props.type) return

  const factory = props.ws.nodeRegister.get(props.type)
  if (!factory) return

  const width = el.clientWidth
  const height = el.clientHeight
  if (width <= 0 || height <= 0) return

  const node = new factory()
  node.setWorkspace(props.ws)

  stage = new Konva.Stage({
    container: el,
    width,
    height,
  })

  const layer = new Konva.Layer()
  view = new NodeView(node)
  layer.add(view.group)
  stage.add(layer)

  fit(layer, width, height)
}

function fit(layer: Konva.Layer, width: number, height: number) {
  if (!view) return

  const nodeW = getNodeWidth(view.entity)
  const nodeH = getNodeHeight(view.entity)
  const padding = 12

  const scale = Math.min(
    (width - padding * 2) / nodeW,
    (height - padding * 2) / nodeH,
  )
  const s = Math.max(0.05, Math.min(scale, 1.6))

  layer.scale({ x: s, y: s })
  layer.position({
    x: (width - nodeW * s) / 2,
    y: (height - nodeH * s) / 2,
  })
  layer.batchDraw()
}

function destroy() {
  // Destroy the view first so the handle-view registries are cleaned up.
  view?.destroy()
  view = null
  stage?.destroy()
  stage = null
}

watch(
  () => props.type,
  () => void render(),
)

watch(container, () => void render())

onBeforeUnmount(() => destroy())
</script>

<template>
  <div ref="container" class="gr-node-preview"></div>
</template>

<style scoped>
.gr-node-preview {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
