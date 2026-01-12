import { defineContext } from '@0x-jerry/vue-kit'
import { useWorkspace } from './useWorkspace'

export const useCoordSystem = defineContext(Symbol.for('coord-system'), () => {
  const state = useWorkspace()!

  return state.coord
})
