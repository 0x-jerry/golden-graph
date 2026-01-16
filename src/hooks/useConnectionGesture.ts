import { defineContext } from '@0x-jerry/vue-kit'
import { useEventListener } from '@vueuse/core'
import { reactive, shallowRef } from 'vue'
import type { IVec2, NodeHandle, Workspace } from '../core'
import { getHandleJointDomPosition } from '../core/domHelper'

export interface UseGestureOptions {
  workspace: Workspace
}

export const useConnectionGesture = defineContext(
  Symbol.for('graph-gesture'),
  (opt: UseGestureOptions) => {
    const ws = opt.workspace

    const state = reactive({
      isConnectingHandle: false,
      handle: shallowRef<NodeHandle>(),
      start: {
        x: 0,
        y: 0,
      },
      end: {
        x: 0,
        y: 0,
      },
    })

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
      state.handle = getStartHandle()
      state.isConnectingHandle = true

      const pos = getHandleJointDomPosition(handle)

      state.start = { ...pos }
      state.end = { ...pos }

      if (state.handle !== handle) {
        const newPos = getHandleJointDomPosition(state.handle)

        if (handle.isLeft) {
          state.end = newPos
        } else {
          state.start = newPos
        }
      }

      return

      function getStartHandle() {
        if (handle.isRight) {
          return handle
        }

        const [edge] = ws.queryEdges(handle.loc)
        if (!edge) {
          return handle
        }

        ws.removeEdgeByIds(edge.id)

        const otherHandle = edge.start === handle ? edge.end : edge.start

        return otherHandle
      }
    }

    function endConnection(handle?: NodeHandle) {
      if (!state.handle) {
        return
      }

      if (handle) {
        ws.connect(state.handle, handle)
      }

      state.isConnectingHandle = false
      state.handle = undefined
    }

    function moveConnection(pos: IVec2) {
      if (!state.handle) {
        return
      }

      if (state.handle.isLeft) {
        state.end = pos
      } else {
        state.start = pos
      }
    }
  },
)
