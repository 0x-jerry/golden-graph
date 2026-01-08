import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useGraph } from './useGraph'

export function useGraphNode(id: MaybeRefOrGetter<string>) {
  const graph = useGraph()!

  const node = computed(() => graph.workspace.nodes.get(toValue(id))!)

  return node
}
