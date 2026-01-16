import { computed, type WritableComputedRef } from 'vue'
import { useNodeHandle } from '../hooks'

export function useNodeHandleValue<T>() {
  const handle = useNodeHandle()!

  const value = computed({
    get() {
      return handle.value.getValue()
    },
    set(value) {
      handle.value.setValue(value)
    },
  })

  return value as WritableComputedRef<T>
}
