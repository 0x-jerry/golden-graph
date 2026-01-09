<script lang="ts" setup>
import { computed, reactive, useTemplateRef } from 'vue'
import TestNode from './TestNode.vue'
import { useCoordSystem } from './useCoordSystem'
import { clamp } from 'lodash-es'
import { useDraggable, useEventListener, useMouseInElement } from '@vueuse/core'
import GridPattern from './GridPattern.vue'
import { useSelection } from './useSelection'
import CubicBezier from './CubicBezier.vue'
import GroupNode from './GroupNode.vue'
import type { Rect, Vec2 } from './types'
import { remove } from '@0x-jerry/utils'

const coord = useCoordSystem.provide()

interface GroupData {
  id: number
  child: number[]
  pos: Vec2
  width: number
  height: number
}

interface NodeData {
  id: number
  pos: Vec2
}

const workspace = reactive({
  nodes: [
    {
      id: 1,
      pos: {
        x: 100,
        y: 100,
      },
    },
    {
      id: 2,
      pos: {
        x: 200,
        y: 200,
      },
    },
  ] satisfies NodeData[],

  groups: [
    {
      id: 1,
      child: [1, 2],
      pos: {
        x: 50,
        y: 50,
      },
      width: 300,
      height: 300,
    },
  ] satisfies GroupData[],
})

fuzzTest()

function fuzzTest() {
  const count = 50

  for (let index = 0; index < count; index++) {
    workspace.nodes.push({
      id: index + 10,
      pos: {
        x: Math.random() * count * 100,
        y: Math.random() * count * 100,
      },
    })
  }
}

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

    for (const node of workspace.nodes) {
      const el = getNodeEl(node.id)

      if (elInRect(el, rect)) {
        selected.push(node.id)
      }
    }

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

const curveTest = computed(() => {
  const p = {
    start: workspace.nodes[0].pos,
    end: workspace.nodes[1].pos,
  }

  return {
    start: {
      x: p.start.x,
      y: p.start.y + 50,
    },
    end: {
      x: p.end.x + 100,
      y: p.end.y + 50,
    },
  }
})

function elInRect(el: Element, rect: Rect) {
  const r = el.getBoundingClientRect()
  const x = r.left
  const y = r.top
  const x1 = r.right
  const y1 = r.bottom

  return x >= rect.x && y >= rect.y && x1 <= rect.x + rect.w && y1 <= rect.y + rect.h
}

function getNodeEl(id: number) {
  const el = document.querySelector(`[data-node-id="${id}"]`)
  if (!el) {
    throw new Error(`Can not find node by id: ${id}`)
  }
  return el
}

function getGroupNodeEl(id: number) {
  const el = document.querySelector(`[data-group-id="${id}"]`)
  if (!el) {
    throw new Error(`Can not find group by id: ${id}`)
  }
  return el
}

function handleGroupMoved(group: GroupData, offset: Vec2) {
  group.pos.x += offset.x
  group.pos.y += offset.y

  workspace.nodes.forEach((item) => {
    if (group.child.includes(item.id)) {
      item.pos.x += offset.x
      item.pos.y += offset.y
    }
  })
}

function handleNodeMoved(node: NodeData) {
  const el = getNodeEl(node.id)

  workspace.groups.forEach((g) => {
    const gEl = getGroupNodeEl(g.id)
    const r = gEl.getBoundingClientRect()
    const inGroup = elInRect(el, {
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
    })

    if (inGroup && !g.child.includes(node.id)) {
      g.child.push(node.id)
      console.log('add node %s to group %s', node.id, g.id)
    } else if (!inGroup && g.child.includes(node.id)) {
      remove(g.child, node.id)
      console.log('remove node %s from group %s', node.id, g.id)
    }
  })
}
</script>

<template>
  <div ref="el" class="coord-system" @wheel="handleZoom">
    <GridPattern />
    <div class="coord-content" :style="coord.getCoordStyle({ x: 0, y: 0 })">
      <GroupNode
        v-for="group in workspace.groups"
        :data-group-id="group.id"
        :key="group.id"
        :pos="group.pos"
        :width="group.width"
        :height="group.height"
        @moved="handleGroupMoved(group, $event)"
      />

      <svg xmlns="http://www.w3.org/2000/svg">
        <CubicBezier v-bind="curveTest" :offset="{ x: 50000, y: 50000 }" />
      </svg>

      <TestNode :model-value="{ x: 0, y: 0 }" disabled>
        <div class="shape-dot"></div>
      </TestNode>
      <TestNode
        v-for="node in workspace.nodes"
        :key="node.id"
        v-model="node.pos"
        :data-node-id="node.id"
        :disabled="gesture.shift"
        @moved="handleNodeMoved(node)"
      >
        <div class="shape-rect">{{ node.id }}</div>
      </TestNode>
    </div>
  </div>
</template>

<style lang="less" scoped>
.coord-system {
  position: relative;
  overflow: hidden;

  margin-top: 5vw;
  margin-left: 5vw;

  width: 90vw;
  height: 90vh;
  border: 1px solid #ccc;

  user-select: none;
}

svg {
  pointer-events: none;
  position: relative;

  width: 100000px;
  height: 100000px;
  left: -50000px;
  top: -50000px;
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

.shape-dot {
  --size: 10px;

  width: var(--size);
  height: var(--size);
  background: black;
  border-radius: 10px;
}

.shape-rect {
  --size: 100px;

  width: var(--size);
  height: var(--size);
  background: rgba(98, 160, 226, 0.543);

  color: white;
  display: flex;
  font-size: 20px;
  align-items: center;
  justify-content: center;
}
</style>
