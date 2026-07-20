<script setup lang="ts">
import { clamp } from '@0x-jerry/utils'
import { computed, ref } from 'vue'
import { useCoordSystem, useWorkspace, useWorkspaceEvent } from '../hooks'
import { getZoomStep, ZOOM_MAX, ZOOM_MIN } from '../renderer/constants'

const ws = useWorkspace()!
const coord = useCoordSystem()!

const scale = ref(coord.scale)

useWorkspaceEvent('coord:changed', () => {
  scale.value = coord.scale
})

const zoomPercent = computed(() => `${Math.round(scale.value * 100)}%`)

/**
 * Anchor zoom at the viewport center (fall back to the origin when no
 * renderer is attached, e.g. headless usage).
 */
function zoomCenter() {
  return ws.renderer?.getViewportCenter?.() ?? { x: 0, y: 0 }
}

function zoomIn() {
  const scale = clamp(coord.scale + getZoomStep(coord.scale), ZOOM_MIN, ZOOM_MAX)
  coord.zoomAt(zoomCenter(), scale)
}

function zoomOut() {
  const scale = clamp(coord.scale - getZoomStep(coord.scale), ZOOM_MIN, ZOOM_MAX)
  coord.zoomAt(zoomCenter(), scale)
}

function resetZoom() {
  coord.reset()
}
</script>

<template>
  <div class="r-workspace-toolbar">
    <button
      class="r-workspace-toolbar-btn"
      title="Zoom out"
      @click.stop="zoomOut"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
    <span class="r-workspace-toolbar-label">{{ zoomPercent }}</span>
    <button
      class="r-workspace-toolbar-btn"
      title="Zoom in"
      @click.stop="zoomIn"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
    <button
      class="r-workspace-toolbar-btn"
      title="Reset view"
      @click.stop="resetZoom"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.r-workspace-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--gr-color-bg-toolbar, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--gr-color-border, rgba(0, 0, 0, 0.1));
  border-radius: 6px;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.r-workspace-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--gr-color-text, #333);
}

.r-workspace-toolbar-btn:hover {
  background: var(--gr-color-bg-hover, rgba(0, 0, 0, 0.06));
}

.r-workspace-toolbar-label {
  min-width: 40px;
  font-size: 11px;
  text-align: center;
  color: var(--gr-color-text-muted, #666);
  user-select: none;
}
</style>
