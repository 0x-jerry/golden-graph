import { shallowReactive } from 'vue'
import type { CoreMenuItem } from '../renderer'
import type { ContextMenuItem } from '../components/ContextMenu.vue'

interface CtxMenuState {
  visible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  /**
   * The target position of the context menu in workspace coordinates
   * (canvas target only), so follow-up actions (e.g. adding a node) can
   * place their result at the right-click point.
   */
  pos?: { x: number; y: number }
}

export function useContextMenuState() {
  const state = shallowReactive<CtxMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  })

  function show(
    x: number,
    y: number,
    menus: CoreMenuItem[],
    pos?: { x: number; y: number },
  ) {
    const visibleMenus = menus.filter((item) => {
      if (item.visible == null) return true
      if (typeof item.visible === 'function') return item.visible()
      return item.visible
    })
    if (!visibleMenus.length) return

    state.visible = true
    state.x = x
    state.y = y
    state.items = visibleMenus
    state.pos = pos
  }

  function hide() {
    state.visible = false
    state.items = []
    state.pos = undefined
  }

  return { state, show, hide }
}
