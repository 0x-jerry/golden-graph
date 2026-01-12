import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { useWorkspace } from "./useWorkspace";
import { defineContext } from "@0x-jerry/vue-kit";

export const useNode = defineContext(
  "workspace-node",
  (id: MaybeRefOrGetter<number>) => {
    const workspace = useWorkspace()!;

    const node = computed(() => {
      const _id = toValue(id);

      const n = workspace.nodes.find((n) => n.id === _id);

      if (!n) {
        throw new Error(`Can not find node by id ${_id}`);
      }

      return n;
    });

    return node;
  }
);
