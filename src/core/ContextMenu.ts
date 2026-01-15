import { reactive } from 'vue'
import type { ContextMenuItem } from '../components/ContextMenu.vue'

export class ContextMenuHelper {
  _state = reactive({
    visible: false,
    x: 0,
    y: 0,
    menus: [] as ContextMenuItem[],
  })

  get state() {
    return this._state
  }

  show(x: number, y: number, menus: ContextMenuItem[]) {
    this._state.visible = true
    this._state.x = x
    this._state.y = y
    this._state.menus = menus
  }

  hide() {
    this._state.visible = false
    this._state.menus = []
  }
}
