<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { Workspace as IWorkspace } from '@0x-jerry/golden-graph'
import { KonvaGraphRenderer } from './renderer'
import type { ContextMenuItem } from './components/ContextMenu.vue'
import { useContextMenuState, useWorkspace } from './hooks'
import WorkspaceToolbar from './components/WorkspaceToolbar.vue'
import ContextMenu from './components/ContextMenu.vue'
import AddNodeDialog from './components/AddNodeDialog.vue'
import { applyThemeToElement } from './theme'
import type { DeepPartial, GraphTheme } from './theme'

export interface KonvaRendererProps {
  setup?: (ws: IWorkspace) => void | Promise<void>
  showToolbar?: boolean
  showContextMenu?: boolean
  /**
   * Partial theme merged over the defaults, replacing any previously applied
   * overrides. Passing a new object hot-swaps the canvas colors/fonts and the
   * `--gr-*` chrome live; omit it (or pass `{}`) for the default light theme.
   */
  theme?: DeepPartial<GraphTheme>
}

const props = withDefaults(defineProps<KonvaRendererProps>(), {
  showToolbar: true,
  showContextMenu: true,
})

const containerRef = useTemplateRef<HTMLElement>('container')
const wrapRef = useTemplateRef<HTMLElement>('wrap')

function syncChrome() {
  if (wrapRef.value && renderer) {
    applyThemeToElement(wrapRef.value, renderer.theme)
  }
}

const ws = useWorkspace.provide()
const ctxMenu = useContextMenuState()
const addNodeVisible = ref(false)
const addNodePos = ref<{ x: number; y: number } | undefined>()

let renderer: KonvaGraphRenderer | null = null

onMounted(async () => {
  const el = containerRef.value
  if (!el) return

  // Create the renderer FIRST so `workspace.setRenderer(this)` is in place
  // before `setup` runs — `setup` may call `ws.addGroup()` which requires a
  // renderer, and node/edge additions during setup are then rendered live.
  renderer = new KonvaGraphRenderer(el, ws, {
    theme: props.theme,
    onContextMenu: (ctx, evt, menus) => {
      ctxMenu.show(evt.clientX, evt.clientY, menus, ctx.pos)
      // Keep the drop position even after the menu closes, so the "Add Node"
      // dialog doesn't depend on menu click/close ordering.
      addNodePos.value = ctx.pos
    },
  })
  syncChrome()

  try {
    await props.setup?.(ws)
  } catch (error) {
    console.error('KonvaRenderer setup failed:', error)
  }
})

onBeforeUnmount(() => {
  // Dispose the renderer BEFORE the workspace: `useWorkspace.provide()`
  // registers `ws.dispose()` on `onUnmounted`, which tears down the event
  // emitter and terminates the worker — the renderer must unsubscribe from
  // the still-alive emitter first so its disposal actually runs.
  renderer?.dispose()
})

watch(
  () => props.theme,
  (t) => {
    if (!renderer) return
    renderer.setTheme(t ?? {})
    syncChrome()
  },
)

function onMenuClick(item: ContextMenuItem) {
  if (item.key === 'add-node') {
    addNodeVisible.value = true
  }
}

defineExpose({
  workspace: ws,
})
</script>

<template>
  <div ref="wrap" class="r-konva-renderer-wrap">
    <div ref="container" class="r-konva-renderer" tabindex="0"></div>
    <WorkspaceToolbar v-if="props.showToolbar" />
    <ContextMenu
      v-if="props.showContextMenu"
      :visible="ctxMenu.state.visible"
      :x="ctxMenu.state.x"
      :y="ctxMenu.state.y"
      :items="ctxMenu.state.items"
      @close="ctxMenu.hide"
      @click="onMenuClick"
    />
    <AddNodeDialog
      v-if="props.showContextMenu"
      :visible="addNodeVisible"
      :pos="addNodePos"
      @close="addNodeVisible = false"
    />
  </div>
</template>

<style>
.r-konva-renderer-wrap {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
.r-konva-renderer {
  width: 100%;
  height: 100%;
  /* Canvas is transparent — the theme's bg token shows through as the
     graph backdrop (the grid dots are drawn on it). */
  background: var(--gr-color-canvas-bg, #ffffff);
  /* The container is focusable (tabindex=0) so canvas keyboard shortcuts
     fire only while the graph has focus. No ring on mouse clicks; a subtle
     one on keyboard focus (:focus-visible) keeps Tab navigation visible. */
  outline: none;
}

.r-konva-renderer:focus-visible {
  outline: 1px solid var(--gr-color-accent, #6366f1);
  outline-offset: -1px;
}
</style>
