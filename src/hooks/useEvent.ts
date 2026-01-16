import type { EventEmitter, Optional } from '@0x-jerry/utils'
import { tryOnUnmounted, watchImmediate } from '@vueuse/core'
import { type MaybeRefOrGetter, toValue } from 'vue'

export function useEvent<T extends Record<string, any>, Key extends keyof T>(
  emitter: MaybeRefOrGetter<Optional<EventEmitter<T>>>,
  event: Key,
  cb: (...e: T[Key]) => void,
) {
  watchImmediate(
    () => toValue(emitter),
    (newEmitter, oldEmitter) => {
      if (oldEmitter) {
        oldEmitter.off(event, cb)
      }

      if (newEmitter) {
        newEmitter.on(event, cb)
      }
    },
  )

  tryOnUnmounted(() => {
    toValue(emitter)?.off(event, cb)
  })
}

type Callbacks<T extends Record<string, any>> = {
  [K in keyof T]?: (...e: T[K]) => void
}

export function useEvents<T extends Record<string, any>>(
  emitter: MaybeRefOrGetter<Optional<EventEmitter<T>>>,
  cbs: Callbacks<T>,
) {
  for (const event of Object.keys(cbs)) {
    if (cbs[event]) {
      useEvent(emitter, event, cbs[event])
    }
  }
}
