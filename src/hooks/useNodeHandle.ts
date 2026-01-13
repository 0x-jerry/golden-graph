import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useNode } from './useNode'
import { defineContext } from '@0x-jerry/vue-kit'

export const useNodeHandle = defineContext(Symbol.for('node-handle'), (key: MaybeRefOrGetter<string>) => {
  const node = useNode()!

  const handle = computed(() => {
    const _key = toValue(key)
    const handle = node.value.handles.find((n) => n.key === _key)

    if (!handle) {
      throw new Error(`Can not find handle by key ${_key}`)
    }
    return handle
  })

  return handle
})