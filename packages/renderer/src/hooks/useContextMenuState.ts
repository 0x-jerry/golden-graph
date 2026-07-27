import { shallowReactive } from 'vue'
import type { CoreMenuItem } from '../renderer'
import type { ContextMenuItem } from '../components/ContextMenu.vue'

interface CtxMenuState {
  visible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
}

export function useContextMenuState() {
  const state = shallowReactive<CtxMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  })

  function show(x: number, y: number, menus: CoreMenuItem[]) {
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
  }

  function hide() {
    state.visible = false
    state.items = []
  }

  return { state, show, hide }
}
