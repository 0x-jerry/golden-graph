import { defineContext } from '@0x-jerry/vue-kit'
import { onUnmounted } from 'vue'
import { Workspace } from '../core'

export const useWorkspace = defineContext(Symbol.for('graph-workspace'), () => {
  const ws = new Workspace()

  onUnmounted(() => {
    ws.dispose()
  })

  return ws
})
