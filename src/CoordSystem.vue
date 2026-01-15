<script lang="ts" setup>
import { clamp } from '@0x-jerry/utils'
import { useDraggable, useEventListener, useMouseInElement } from '@vueuse/core'
import { reactive, useTemplateRef } from 'vue'
import GridPattern from './GridPattern.vue'
import { useConnectionGesture, useCoordSystem, useSelection, useWorkspace } from './hooks'
import { RectBox } from './utils/RectBox'

const ws = useWorkspace()!
const coord = useCoordSystem()!

const connectionGesture = useConnectionGesture()!

const el = useTemplateRef('el')

const mouseInElement = useMouseInElement(el)

const state = reactive({
  shift: false,
  selected: [] as number[],
})

useEventListener('keydown', (evt) => {
  if (evt.key === 'Shift' || evt.shiftKey) {
    state.shift = true
  }
})

useEventListener('keyup', (evt) => {
  if (evt.key === 'Shift' || evt.shiftKey) {
    state.shift = false
  }
})

useDraggable(el, {
  exact: true,
  onStart() {
    if (state.shift) {
      return false
    }
  },
  onMove(_position, event) {
    coord.move(event.movementX, event.movementY)
  },
})

useSelection({
  disabled() {
    return !state.shift
  },
  onStart() {
    state.selected = []
  },
  onMove(rect) {
    const coordRect = el.value?.getBoundingClientRect()
    if (!coordRect) {
      return
    }

    const tl = coord.convertScreenCoord({
      x: rect.left - coordRect.left,
      y: rect.top - coordRect.top
    })

    const rb = coord.convertScreenCoord({
      x: rect.right - coordRect.left,
      y: rect.bottom - coordRect.top
    })

    const converted = RectBox.fromRectBox(tl.x, tl.y, rb.x, rb.y)
    state.selected = queryNodesByBounding(converted)
  },
  onEnd() {
    const selected = state.selected

    ws.addGroup(selected)

    state.selected = []
  },
})

function queryNodesByBounding(rect: RectBox) {
  const ids: number[] = []

  for (const node of ws.nodes) {
    const r = ws.getNodesBounding(node.id)
    if (rect.includes(r)) {
      ids.push(node.id)
    }
  }

  return ids
}

function handleZoom(event: WheelEvent) {
  event.preventDefault()

  const pos = {
    x: mouseInElement.elementX.value,
    y: mouseInElement.elementY.value,
  }

  const scaleStep = coord.scale > 1 ? 0.05 : coord.scale > 0.1 ? 0.025 : 0.01

  let scale = coord.scale + (event.deltaY < 0 ? 1 : -1) * scaleStep

  scale = clamp(scale, 0.01, 2)

  coord.zoomAt(pos, scale)
}

function handlePointerMove(evt: MouseEvent) {
  if (!el.value) {
    return
  }

  const r = el.value.getBoundingClientRect()
  const x = evt.clientX - r.left
  const y = evt.clientY - r.top

  connectionGesture.moveConnection(coord.convertScreenCoord({ x, y }))
}
</script>

<template>
  <div ref="el" class="coord-system" @wheel="handleZoom" @pointermove="handlePointerMove" @pointerdown.self="ws.setActiveId(null)">
    <GridPattern />
    <div class="coord-content" :style="coord.getCoordStyle({ x: 0, y: 0 })">
      <slot></slot>
    </div>
  </div>
</template>

<style lang="less" scoped>
.coord-system {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;

  border: 1px solid var(--gr-color-border, gray);

  user-select: none;
}

.coord-content {
  pointer-events: none;

  position: absolute;
  left: 0;
  top: 0;

  translate: var(--x) var(--y);
  scale: var(--scale);
  transform-origin: top left;
}
</style>
