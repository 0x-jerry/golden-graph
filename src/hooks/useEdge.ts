import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useWorkspace } from './useWorkspace'

export function useEdge(id: MaybeRefOrGetter<number>) {
  const ws = useWorkspace()!

  const edge = computed(() => {
    const _id = toValue(id)
    const edge = ws.edges.find((n) => n.id === _id)

    if (!edge) {
      throw new Error(`Can not find edge by id ${_id}`)
    }

    return edge
  })

  return edge
}
