import type { Component } from 'vue'
import DefaultHandle from './DefaultHandle.vue'
import DisplayHandle from './DisplayHandle.vue'
import NumberHandle from './NumberHandle.vue'
import TextHandle from './TextHandle.vue'

export function getHandleComponent(type: string) {
  const map: Record<string, Component> = {
    text: TextHandle,
    number: NumberHandle,
    display: DisplayHandle,
  }

  return map[type] ?? DefaultHandle
}
