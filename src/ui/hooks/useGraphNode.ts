import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useGraph } from './useGraph'
import { useRefresh } from './useRefresh'
import { useGraphEvent } from './useGraphEvent'

export function useGraphNode(id: MaybeRefOrGetter<string>) {
  const graph = useGraph()!

  const refresh = useRefresh()

  const node = computed(() => {
    refresh.dirty()
    return graph.workspace.nodes.get(toValue(id))!
  })

  useGraphEvent(node, 'updated', () => refresh.trigger())

  return node
}
