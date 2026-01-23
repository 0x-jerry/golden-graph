<script lang="ts" setup>
import { clamp } from '@0x-jerry/utils'
import { useDraggable, useMouseInElement } from '@vueuse/core'
import { useTemplateRef } from 'vue'
import type { ContextMenuItem } from './components/ContextMenu.vue'
import { ActiveType } from './core'
import { getNodesBounding } from './core/domHelper'
import GridPattern from './GridPattern.vue'
import { useConnectionGesture, useCoordSystem, useEvents, useWorkspace } from './hooks'
import { RectBox } from './utils/RectBox'

const ws = useWorkspace()!
const coord = useCoordSystem()!

const connectionGesture = useConnectionGesture()!

const el = useTemplateRef('el')

const mouseInElement = useMouseInElement(el)

const data = {
  selected: [] as number[],
}

const ContextMenus: ContextMenuItem[] = [
  {
    label: 'Exit SubGraph',
    visible: () => !!ws.isActiveSubGraph,
    action: () => {
      ws.exitSubGraph()
    },
  },
]

useDraggable(el, {
  exact: true,
  onStart() {
    if (ws.interactive.state.shift) {
      return false
    }
  },
  onMove(_position, event) {
    coord.move(event.movementX, event.movementY)
  },
})

useEvents(ws.interactive.events, {
  'selection:start': () => {
    data.selected = []
  },
  'selection:move': (rect) => {
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
    data.selected = queryNodesByBounding(converted)
  },
  'selection:end': () => {
    const selected = data.selected

    ws.setActiveIds(ActiveType.Node, selected)

    data.selected = []
  },
})

function queryNodesByBounding(rect: RectBox) {
  const ids: number[] = []

  for (const node of ws.nodes) {
    const r = getNodesBounding([node])
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

function handleContextMenu(evt: MouseEvent) {
  ws.showContextMenus(evt, ContextMenus)
}
</script>

<template>
  <div ref="el" class="coord-system"  :data-scale="coord.scale" :data-origin="`${coord.origin.x} ${coord.origin.y}`"
        @wheel="handleZoom" @pointermove="handlePointerMove" @pointerdown.self="ws.clearActiveIds()"
        @contextmenu.stop="handleContextMenu"
        >
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
