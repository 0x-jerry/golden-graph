import { defineContext } from '@0x-jerry/vue-kit'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useWorkspace } from './useWorkspace'

export const useGroup = defineContext(
  'workspace-group',
  (id: MaybeRefOrGetter<number>) => {
    const workspace = useWorkspace()!

    const group = computed(() => {
      const _id = toValue(id)

      const n = workspace.groups.find((n) => n.id === _id)

      if (!n) {
        throw new Error(`Can not find node by id ${_id}`)
      }

      return n
    })

    return group
  },
)
