import { remove } from '@0x-jerry/utils'
import { defineContext } from '@0x-jerry/vue-kit'
import { shallowReactive } from 'vue'
import type { GWorkspace } from '../../core'
import { ModelManagerChangedType } from '../../core/ModelManager'
import { useCoordSystem } from './useCoordSystem'
import { useGraphEvent } from './useGraphEvent'

interface IUseGraphOption {
  workspace: GWorkspace
}

export const useGraph = defineContext(
  Symbol.for('g-graph'),
  (opt: IUseGraphOption) => {
    const { workspace } = opt

    const coord = useCoordSystem.provide()

    const state = {
      workspace,
      nodeIds: shallowReactive<string[]>([]),
      coord,
    }

    state.nodeIds.push(...workspace.nodes.all().map((n) => n.id))

    useGraphEvent(workspace.nodes, 'changed', (type, id) => {
      if (type === ModelManagerChangedType.Added) {
        state.nodeIds.push(id)
      } else {
        remove(state.nodeIds, id)
      }
    })

    return state
  },
)
