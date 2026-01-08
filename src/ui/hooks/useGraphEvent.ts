import type { EventEmitter } from '@0x-jerry/utils'
import { isRef, onUnmounted, toValue, watch, type MaybeRefOrGetter } from 'vue'

type EventsDefine<T> = T extends EventEmitter<infer E> ? E : never

export function useGraphEvent<
  T extends EventEmitter<E>,
  E extends {} = EventsDefine<T>,
  K extends keyof E = keyof E
>(
  target: MaybeRefOrGetter<T>,
  event: K,
  callback: (...args: E[K] extends any[] ? E[K] : []) => void
) {
  toValue(target).on(event, callback as any)

  onUnmounted(() => {
    toValue(target).off(event, callback as any)
  })

  if (isRef(target)) {
    watch(target, (newVal, oldVal) => {
      oldVal.off(event, callback as any)
      newVal.on(event, callback as any)
    })
  }
}
