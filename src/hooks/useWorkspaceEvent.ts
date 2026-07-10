import { onMounted, onUnmounted } from 'vue'
import type { WorkspaceEvents } from '../core'
import { useWorkspace } from './useWorkspace'

export function useWorkspaceEvent<E extends keyof WorkspaceEvents>(
  event: E,
  handler: (...args: WorkspaceEvents[E]) => void,
) {
  const ws = useWorkspace()!

  let _unsub: (() => void) | null = null
  onMounted(() => {
    _unsub = ws.events.on(event, handler)
  })
  onUnmounted(() => {
    _unsub?.()
  })
}
