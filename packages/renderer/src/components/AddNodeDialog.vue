<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { addNodeFromOption, collectAddableNodes } from '../renderer'
import type { AddableNodeGroup, AddableNodeOption } from '../renderer'
import { useWorkspace } from '../hooks'
import NodePreview from './NodePreview.vue'

export interface AddNodeDialogProps {
  visible: boolean
  pos?: { x: number; y: number }
}

export interface AddNodeDialogEmits {
  close: []
}

const props = defineProps<AddNodeDialogProps>()

const emit = defineEmits<AddNodeDialogEmits>()

const ws = useWorkspace()!

// Providers are registered asynchronously (e.g. fetched from a backend), so
// the groups are re-collected on every open instead of computed once.
const groups = ref<AddableNodeGroup[]>([])

const query = ref('')
const activeProviderId = ref<string>('')
const hovered = ref<AddableNodeOption | null>(null)

const listRef = ref<HTMLDivElement>()
const inputRef = ref<HTMLInputElement>()
const sectionRefs = new Map<string, HTMLElement>()
const nodeEls: HTMLElement[] = []

const normalize = (s: string) => s.trim().toLowerCase()

const visibleGroups = computed(() => {
  const q = normalize(query.value)
  if (!q) return groups.value

  return groups.value
    .map((group) => ({
      ...group,
      nodes: group.nodes.filter((n) => normalize(n.name).includes(q)),
    }))
    .filter((group) => group.nodes.length)
})

const flatNodes = computed(() => visibleGroups.value.flatMap((g) => g.nodes))

function setSectionRef(
  providerId: string,
  el: Element | ComponentPublicInstance | null,
) {
  if (el) {
    sectionRefs.set(providerId, el as HTMLElement)
  } else {
    sectionRefs.delete(providerId)
  }
}

function setNodeRef(
  index: number,
  el: Element | ComponentPublicInstance | null,
) {
  if (el) {
    nodeEls[index] = el as HTMLElement
  } else {
    delete nodeEls[index]
  }
}

function globalNodeIndex(node: AddableNodeOption) {
  return flatNodes.value.findIndex((n) => n.type === node.type)
}

function scrollToNode(index: number) {
  nodeEls[index]?.scrollIntoView({ block: 'nearest' })
}

/**
 * Move the selected node through the flat list of visible nodes, wrapping at
 * the ends, and keep the section sidebar in sync with the new position.
 */
function moveSelection(delta: number) {
  const nodes = flatNodes.value
  if (!nodes.length) return

  const current = hovered.value
    ? nodes.findIndex((n) => n.type === hovered.value!.type)
    : -1
  const next = current < 0 ? 0 : (current + delta + nodes.length) % nodes.length
  const node = nodes[next]
  if (!node) return

  hovered.value = node
  scrollToNode(next)

  const group = visibleGroups.value.find((g) => g.nodes.includes(node))
  if (group) {
    activeProviderId.value = group.providerId
  }
}

function scrollToGroup(providerId: string) {
  const el = sectionRefs.get(providerId)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  activeProviderId.value = providerId
}

function onListScroll() {
  const list = listRef.value
  if (!list) return

  const listTop = list.getBoundingClientRect().top
  let best: string | undefined
  let bestDist = Infinity

  for (const [providerId, el] of sectionRefs) {
    const dist = Math.abs(el.getBoundingClientRect().top - listTop)
    if (dist < bestDist) {
      bestDist = dist
      best = providerId
    }
  }

  if (best) {
    activeProviderId.value = best
  }
}

function loadGroups() {
  groups.value = collectAddableNodes(ws)
}

function reset() {
  query.value = ''
  hovered.value = null
  activeProviderId.value = groups.value[0]?.providerId ?? ''
}

function selectFirstNode() {
  hovered.value = flatNodes.value[0] ?? null
  if (hovered.value) {
    scrollToNode(0)
  }
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      loadGroups()
      reset()
      await nextTick()
      selectFirstNode()
      listRef.value?.scrollTo({ top: 0 })
      inputRef.value?.focus()
    }
  },
)

watch(visibleGroups, async (groups) => {
  if (!groups.some((g) => g.providerId === activeProviderId.value)) {
    activeProviderId.value = groups[0]?.providerId ?? ''
  }

  // Keep a preview when the selected node is filtered out by a search —
  // fall back to the first remaining result instead of clearing it. Wait for
  // the DOM patch so the scroll targets the freshly rendered first node.
  if (
    hovered.value &&
    !groups.some((g) => g.nodes.some((n) => n.type === hovered.value!.type))
  ) {
    await nextTick()
    selectFirstNode()
  }
})

function selectNode(node: AddableNodeOption) {
  addNodeFromOption(ws, node, props.pos)
  emit('close')
}

function hoverNode(node: AddableNodeOption) {
  hovered.value = node
  const group = visibleGroups.value.find((g) =>
    g.nodes.some((n) => n.type === node.type),
  )
  if (group) {
    activeProviderId.value = group.providerId
  }
}

function onKeydown(e: KeyboardEvent) {
  // Ignore IME composition keys (e.g. confirming CJK input) — the arrow
  // keys and Enter belong to the composition flow, not the dialog.
  if (e.isComposing || e.keyCode === 229) return

  if (e.key === 'Escape') {
    emit('close')
    return
  }

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    moveSelection(e.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (e.key === 'Enter' && hovered.value) {
    e.preventDefault()
    selectNode(hovered.value)
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="gr-add-node-dialog">
      <div class="gr-add-node-backdrop" @click="emit('close')"></div>

      <div class="gr-add-node-panel" @click.stop>
        <div class="gr-add-node-search">
          <input
            ref="inputRef"
            v-model="query"
            class="gr-add-node-search-input"
            type="text"
            placeholder="Search nodes..."
          />
        </div>

        <div class="gr-add-node-body">
          <div class="gr-add-node-groups">
            <div
              v-for="group in visibleGroups"
              :key="group.providerId"
              class="gr-add-node-group"
              :class="{ active: group.providerId === activeProviderId }"
              @click="scrollToGroup(group.providerId)"
            >
              {{ group.providerName }}
            </div>
          </div>

          <div ref="listRef" class="gr-add-node-nodes" @scroll="onListScroll">
            <template v-if="visibleGroups.length">
              <div
                v-for="group in visibleGroups"
                :key="group.providerId"
                class="gr-add-node-section"
                :ref="(el) => setSectionRef(group.providerId, el)"
              >
                <div class="gr-add-node-section-title">
                  {{ group.providerName }}
                </div>
                <div
                  v-for="node in group.nodes"
                  :key="node.type"
                  class="gr-add-node-node"
                  :class="{ active: hovered?.type === node.type }"
                  :ref="(el) => setNodeRef(globalNodeIndex(node), el)"
                  @mouseenter="hoverNode(node)"
                  @click="selectNode(node)"
                >
                  <div class="gr-add-node-node-name">{{ node.name }}</div>
                  <div v-if="node.description" class="gr-add-node-node-desc">
                    {{ node.description }}
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="gr-add-node-empty">No nodes found</div>
          </div>

          <div class="gr-add-node-preview">
            <NodePreview
              v-if="hovered"
              :ws="ws"
              :type="hovered.type"
              :sub-graph-id="hovered.subGraphId"
            />
            <div v-else class="gr-add-node-preview-hint">
              Hover a node to preview
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.gr-add-node-dialog {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gr-add-node-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.gr-add-node-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 720px;
  max-width: calc(100vw - 48px);
  height: 480px;
  max-height: calc(100vh - 48px);
  background: var(--gr-color-surface, #ffffff);
  border: 1px solid var(--gr-color-border, #e2e2e8);
  border-radius: 8px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  color: var(--gr-color-text-primary, #1f2328);
  overflow: hidden;
}

.gr-add-node-search {
  padding: 12px;
  border-bottom: 1px solid var(--gr-color-border, #e2e2e8);
}

.gr-add-node-search-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--gr-color-border, #e2e2e8);
  border-radius: 4px;
  background: var(--gr-color-bg-input, #f6f6f8);
  color: inherit;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.gr-add-node-search-input:focus {
  border-color: var(--gr-color-accent, #6366f1);
}

.gr-add-node-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.gr-add-node-groups {
  width: 180px;
  flex-shrink: 0;
  padding: 8px 4px;
  border-right: 1px solid var(--gr-color-border, #e2e2e8);
  overflow-y: auto;
  box-sizing: border-box;
}

.gr-add-node-group {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--gr-color-text-primary, #1f2328);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gr-add-node-group:hover {
  background: var(--gr-color-bg-hover, rgba(0, 0, 0, 0.05));
}

.gr-add-node-group.active {
  background: var(--gr-color-accent, #6366f1);
  color: #ffffff;
}

.gr-add-node-nodes {
  flex: 1;
  min-width: 0;
  padding: 8px;
  overflow-y: auto;
  box-sizing: border-box;
}

.gr-add-node-section-title {
  position: sticky;
  top: 0;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--gr-color-text-muted, #5f6670);
  background: var(--gr-color-surface, #ffffff);
  z-index: 1;
}

.gr-add-node-node {
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.gr-add-node-node:hover,
.gr-add-node-node.active {
  background: var(--gr-color-bg-hover, rgba(0, 0, 0, 0.05));
}

.gr-add-node-node.active {
  background: var(--gr-color-accent, #6366f1);
}

.gr-add-node-node.active .gr-add-node-node-name,
.gr-add-node-node.active .gr-add-node-node-desc {
  color: #ffffff;
}

.gr-add-node-node-name {
  font-size: 13px;
  color: var(--gr-color-text-primary, #1f2328);
}

.gr-add-node-node-desc {
  margin-top: 2px;
  font-size: 11px;
  color: var(--gr-color-text-muted, #5f6670);
}

.gr-add-node-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--gr-color-text-muted, #5f6670);
}

.gr-add-node-preview {
  width: 260px;
  flex-shrink: 0;
  border-left: 1px solid var(--gr-color-border, #e2e2e8);
  background: var(--gr-color-bg-preview, #fafafb);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
}

.gr-add-node-preview-hint {
  font-size: 12px;
  color: var(--gr-color-text-muted, #5f6670);
}
</style>
