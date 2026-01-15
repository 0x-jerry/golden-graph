import type { Component } from 'vue'
import DefaultHandle from './DefaultHandle.vue'
import DisplayHandle from './DisplayHandle.vue'
import NumberHandle from './NumberHandle.vue'
import SelectHandle from './SelectHandle.vue'
import TextHandle from './TextHandle.vue'

export function getHandleComponent(type: string) {
  const map: Record<string, Component> = {
    text: TextHandle,
    number: NumberHandle,
    display: DisplayHandle,
    select: SelectHandle,
  }

  return map[type] ?? DefaultHandle
}
