import { reactive, toValue } from 'vue'
import type { ContextMenuItem } from '../components/ContextMenu.vue'
import { toReadonly } from './helper'
import type { Workspace } from './Workspace'

export interface ContextMenuHelperState {
  visible: boolean
  x: number
  y: number
  menus: ContextMenuItem[]
}

export class ContextMenuHelper {
  _workspace?: Workspace

  _state: ContextMenuHelperState = reactive({
    visible: false,
    x: 0,
    y: 0,
    menus: [],
  })

  constructor(workspace?: Workspace) {
    this._workspace = workspace
  }

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
    this._state.menus = visibleMenus
    this._workspace?.events.emit('contextmenu:changed', this._state)
  }

  hide() {
    this._state.visible = false
    this._state.menus = []
    this._workspace?.events.emit('contextmenu:changed', this._state)
  }
}
