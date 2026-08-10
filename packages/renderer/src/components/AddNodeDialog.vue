<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { collectAddableNodes } from '../renderer'
import type { AddableNodeGroup, AddableNodeOption } from '../renderer'
import { useWorkspace } from '../hooks'
import NodePreview from './NodePreview.vue'

const props = defineProps<{
  visible: boolean
  pos?: { x: number; y: number }
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const ws = useWorkspace()!

// Providers are registered asynchronously (e.g. fetched from a backend), so
// the groups are re-collected on every open instead of computed once.
const groups = ref<AddableNodeGroup[]>([])

const query = ref('')
const activeProviderId = ref<string>('')
const hovered = ref<AddableNodeOption | null>(null)

const listRef = ref<HTMLDivElement>()
const sectionRefs = new Map<string, HTMLElement>()

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

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      loadGroups()
      reset()
      await nextTick()
      if (groups.value[0]) {
        activeProviderId.value = groups.value[0]!.providerId
      }
      listRef.value?.scrollTo({ top: 0 })
    }
  },
)

watch(visibleGroups, (groups) => {
  if (!groups.some((g) => g.providerId === activeProviderId.value)) {
    activeProviderId.value = groups[0]?.providerId ?? ''
  }

  // Clear the preview when the hovered node is filtered out by a search.
  if (
    hovered.value &&
    !groups.some((g) => g.nodes.some((n) => n.type === hovered.value!.type))
  ) {
    hovered.value = null
  }
})

function selectNode(node: AddableNodeOption) {
  ws.addNode(node.type, props.pos ? { pos: props.pos } : undefined)
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
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
    <div v-if="props.visible" class="gr-add-node-dialog">
      <div class="gr-add-node-backdrop" @click="emit('close')"></div>

      <div class="gr-add-node-panel" @click.stop>
        <div class="gr-add-node-search">
          <input
            v-model="query"
            class="gr-add-node-search-input"
            type="text"
            placeholder="Search nodes..."
            autofocus
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

          <div
            ref="listRef"
            class="gr-add-node-nodes"
            @scroll="onListScroll"
            @mouseleave="hovered = null"
          >
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
                  @mouseenter="hovered = node"
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
            <NodePreview v-if="hovered" :ws="ws" :type="hovered.type" />
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

.gr-add-node-node:hover {
  background: var(--gr-color-bg-hover, rgba(0, 0, 0, 0.05));
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
