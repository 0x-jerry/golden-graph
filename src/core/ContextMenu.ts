import { reactive, toValue } from 'vue'
import type { ContextMenuItem } from '../components/ContextMenu.vue'
import { toReadonly } from './helper'

export class ContextMenuHelper {
  _state = reactive({
    visible: false,
    x: 0,
    y: 0,
    menus: [] as ContextMenuItem[],
  })

  get state() {
    return toReadonly(this._state)
  }

  show(x: number, y: number, menus: ContextMenuItem[]) {
    const visibleMenus = menus.filter((item) =>
      item.visible == null ? true : toValue(item.visible),
    )

    if (!visibleMenus.length) {
      return
    }

    this._state.visible = true
    this._state.x = x
    this._state.y = y
    this._state.menus = visibleMenus as any
  }

  hide() {
    this._state.visible = false
    this._state.menus = []
  }
}
