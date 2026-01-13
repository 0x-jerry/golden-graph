import { computed } from 'vue'
import { useNodeHandle } from '../hooks'

export function useNodeHandleValue<T>() {
  const handle = useNodeHandle()!

  return computed({
    get() {
      return handle.value.getValue<T>()
    },
    set(value: T) {
      handle.value.setValue(value)
    },
  })
}
