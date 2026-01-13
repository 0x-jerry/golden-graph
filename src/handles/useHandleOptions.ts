import type { INodeHandleConfigOptions } from '../core'
import { useNodeHandle } from '../hooks'

export function useHandleOptions<
  T extends INodeHandleConfigOptions = INodeHandleConfigOptions,
>() {
  const handle = useNodeHandle()!

  return handle.value.getOptions<T>()
}
