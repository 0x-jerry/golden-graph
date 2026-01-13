import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useNode } from './useNode'

export function useNodeHandle(key: MaybeRefOrGetter<string>) {
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
}
