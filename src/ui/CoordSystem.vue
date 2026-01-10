<script lang="ts" setup>
import { clamp } from '@0x-jerry/utils'
import { useDraggable, useEventListener, useMouseInElement } from '@vueuse/core'
import { reactive, useTemplateRef } from 'vue'
import GridPattern from './GridPattern.vue'
import { useCoordSystem, useSelection } from './hooks'

const coord = useCoordSystem()!

const el = useTemplateRef('el')

const mouseInElement = useMouseInElement(el)

const gesture = reactive({
  shift: false,
  selected: [] as number[],
})

useEventListener('keydown', (evt) => {
  if (evt.key === 'Shift' || evt.shiftKey) {
    gesture.shift = true
  }
})

useEventListener('keyup', (evt) => {
  if (evt.key === 'Shift' || evt.shiftKey) {
    gesture.shift = false
  }
})

useDraggable(el, {
  exact: true,
  onStart(position, event) {
    if (gesture.shift) {
      return false
    }
  },
  onMove(_position, event) {
    coord.move(event.movementX, event.movementY)
  },
})

useSelection({
  disabled() {
    return !gesture.shift
  },
  onStart() {
    gesture.selected = []
  },
  onMove(rect) {
    const selected: number[] = []
    // todo

    gesture.selected = selected
  },
  onEnd() {
    const selected = gesture.selected

    console.log('selected nodes', selected)

    gesture.selected = []
  },
})

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
</script>

<template>
  <div ref="el" class="coord-system" @wheel="handleZoom">
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

  border: 1px solid gray;

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
