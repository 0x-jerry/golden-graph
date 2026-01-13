import { defineContext } from '@0x-jerry/vue-kit'
import { useEventListener } from '@vueuse/core'
import { reactive } from 'vue'
import type { IVec2, NodeHandle } from '../core'

export interface UseGestureOptions {
  onCreateEdge?(start: NodeHandle, end: NodeHandle): void
}

export const useConnectionGesture = defineContext(
  Symbol.for('graph-gesture'),
  (opt: UseGestureOptions) => {
    const state = reactive({
      isConnectingHandle: false,
      start: {
        x: 0,
        y: 0,
      },
      end: {
        x: 0,
        y: 0,
      },
    })

    const data = {
      startHandle: null as null | NodeHandle,
    }

    useEventListener('pointerup', () => {
      if (!state.isConnectingHandle) {
        return
      }
      endConnection()
    })

    return {
      state,
      startConnection,
      endConnection,
      moveConnection,
    }

    function startConnection(handle: NodeHandle) {
      data.startHandle = handle
      state.isConnectingHandle = true

      const pos = handle.getJointDomPosition()

      state.start = { ...pos }
      state.end = { ...pos }
    }

    function endConnection(handle?: NodeHandle) {
      if (!data.startHandle) {
        return
      }

      if (handle) {
        opt.onCreateEdge?.(data.startHandle, handle)
      }

      state.isConnectingHandle = false
      data.startHandle = null
    }

    function moveConnection(pos: IVec2) {
      if (!data.startHandle) {
        return
      }

      if (data.startHandle.isInput) {
        state.end = pos
      } else {
        state.start = pos
      }
    }
  },
)
