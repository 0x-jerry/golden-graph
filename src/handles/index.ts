import type { Component } from 'vue'
import DefaultHandle from './DefaultHandle.vue'
import TextHandle from './TextHandle.vue'

export function getHandleComponent(type: string) {
  const map: Record<string, Component> = {
    text: TextHandle,
  }

  return map[type] ?? DefaultHandle
}
