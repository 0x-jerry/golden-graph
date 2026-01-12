import { computed, type MaybeRefOrGetter } from "vue";
import { useNode } from "./useNode";

export function useNodeHandle(key: MaybeRefOrGetter<string>) {
  const node = useNode()!;

  const handle = computed(() => {
    node.value?.handles.find((n) => n.key === key);
  });

  return handle;
}
