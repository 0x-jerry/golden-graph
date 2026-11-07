<script setup lang="ts" generic="T extends string">
import { computed, nextTick, reactive, useId, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'

export interface SelectOption<V extends string> {
  value: V
  label: string
}

export interface SelectProps<V extends string> {
  options: readonly SelectOption<V>[]
  disabled?: boolean
  title?: string
}

const PANEL_MAX_HEIGHT = 220

const props = defineProps<SelectProps<T>>()
const model = defineModel<T>({ required: true })

const id = useId()
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLElement>('trigger')
const panel = useTemplateRef<HTMLElement>('panel')

const state = reactive({
  isOpen: false,
  isUp: false,
  activeIndex: 0,
})

const selectedLabel = computed(
  () => props.options.find((item) => item.value === model.value)?.label ?? '',
)

function open() {
  if (props.disabled || state.isOpen) {
    return
  }

  const selected = props.options.findIndex(
    (item) => item.value === model.value,
  )

  state.activeIndex = Math.max(0, selected)
  state.isUp = shouldOpenUp()
  state.isOpen = true

  nextTick(scrollActiveIntoView)
}

function shouldOpenUp() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) {
    return false
  }

  const spaceBelow = window.innerHeight - rect.bottom
  return spaceBelow < PANEL_MAX_HEIGHT && rect.top > spaceBelow
}

function close() {
  state.isOpen = false
}

function moveActive(step: number) {
  const count = props.options.length
  if (!count) {
    return
  }

  state.activeIndex = (state.activeIndex + step + count) % count
  nextTick(scrollActiveIntoView)
}

function scrollActiveIntoView() {
  panel.value?.children[state.activeIndex]?.scrollIntoView({
    block: 'nearest',
  })
}

function choose(index: number) {
  const option = props.options[index]
  if (option) {
    model.value = option.value
  }

  close()
  trigger.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return
  }

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()

      if (state.isOpen) {
        moveActive(event.key === 'ArrowDown' ? 1 : -1)
      } else {
        open()
      }
      return

    case 'Enter':
    case ' ':
      event.preventDefault()

      if (state.isOpen) {
        choose(state.activeIndex)
      } else {
        open()
      }
      return

    case 'Home':
    case 'End':
      if (!state.isOpen) {
        return
      }

      event.preventDefault()
      state.activeIndex = event.key === 'Home' ? 0 : props.options.length - 1
      nextTick(scrollActiveIntoView)
      return

    case 'Escape':
      close()
      return

    case 'Tab':
      close()
  }
}

function onTriggerClick() {
  if (state.isOpen) {
    close()
  } else {
    open()
  }
}

onClickOutside(root, close)
</script>

<template>
  <div ref="root" class="select">
    <div
      ref="trigger"
      class="select-trigger"
      role="combobox"
      tabindex="0"
      aria-haspopup="listbox"
      :aria-expanded="state.isOpen"
      :aria-controls="`${id}-listbox`"
      :aria-activedescendant="
        state.isOpen ? `${id}-option-${state.activeIndex}` : undefined
      "
      :aria-disabled="props.disabled || undefined"
      :title="props.title"
      @click="onTriggerClick"
      @keydown="onKeydown"
    >
      <span class="select-label">{{ selectedLabel }}</span>
      <span class="select-arrow" aria-hidden="true"></span>
    </div>

    <ul
      v-if="state.isOpen"
      :id="`${id}-listbox`"
      ref="panel"
      class="select-panel"
      :class="{ 'is-up': state.isUp }"
      role="listbox"
    >
      <li
        v-for="(option, index) in props.options"
        :id="`${id}-option-${index}`"
        :key="option.value"
        class="select-option"
        :class="{
          'is-active': index === state.activeIndex,
          'is-selected': option.value === model,
        }"
        role="option"
        :aria-selected="option.value === model"
        @pointerenter="state.activeIndex = index"
        @click="choose(index)"
      >
        {{ option.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.select {
  position: relative;
  display: inline-block;
  font-family: inherit;
  font-size: 12px;
}

.select-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 28px;
  padding: 0 8px 0 10px;
  white-space: nowrap;
  color: var(--gr-color-text, #1f2328);
  background: var(--gr-color-bg-input, #f4f1e8);
  border: 1px solid var(--gr-color-border, rgba(31, 35, 40, 0.25));
  border-radius: 4px;
  cursor: pointer;
}

.select-trigger:hover {
  background: var(--gr-color-bg-hover, rgba(31, 35, 40, 0.07));
}

.select-trigger:focus-visible {
  outline: 1px solid var(--gr-color-accent, #b3261e);
  outline-offset: 1px;
}

.select-trigger[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
}

.select-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.select-arrow {
  margin-left: auto;
  border-top: 4px solid currentColor;
  border-right: 3px solid transparent;
  border-left: 3px solid transparent;
}

.select-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 100%;
  max-height: 220px;
  margin: 0;
  padding: 4px;
  overflow: auto;
  list-style: none;
  color: var(--gr-color-text, #1f2328);
  background: var(--gr-color-bg-input, #f4f1e8);
  border: 1px solid var(--gr-color-border, rgba(31, 35, 40, 0.25));
  border-radius: 4px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}

.select-panel.is-up {
  top: auto;
  bottom: calc(100% + 4px);
}

.select-option {
  padding: 4px 8px;
  white-space: nowrap;
  border-radius: 3px;
  cursor: pointer;
}

.select-option.is-active {
  background: var(--gr-color-bg-hover, rgba(31, 35, 40, 0.07));
}

.select-option.is-selected {
  color: var(--gr-color-accent, #b3261e);
}
</style>
