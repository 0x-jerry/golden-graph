import { defineContext } from '@0x-jerry/vue-kit'
import { type GWorksapce } from '../../core'
import { shallowReactive } from 'vue'
import { remove } from '@0x-jerry/utils'
import { useGraphEvent } from './useGraphEvent'
import { ModelManagerChangedType } from '../../core/ModelManager'

interface IuseGraphOption {
  workspace: GWorksapce
}

export const useGraph = defineContext(Symbol.for('g-graph'), (opt: IuseGraphOption) => {
  const { workspace } = opt

  const state = {
    workspace,
    nodeIds: shallowReactive<string[]>([]),
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
})
