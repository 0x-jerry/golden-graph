import type { Workspace } from './Workspace'

export interface CoreMenuItem {
  key?: string | number
  label: string
  icon?: string
  disabled?: boolean
  shortcut?: string
  visible?: boolean | (() => boolean)
  action?: () => void
  children?: CoreMenuItem[]
}

export interface ContextMenuHelperState {
  visible: boolean
  x: number
  y: number
  menus: CoreMenuItem[]
}

export class ContextMenuHelper {
  _workspace?: Workspace

  _state: ContextMenuHelperState = {
    visible: false,
    x: 0,
    y: 0,
    menus: [],
  }

  constructor(workspace?: Workspace) {
    this._workspace = workspace
  }

  get state() {
    return this._state
  }

  show(x: number, y: number, menus: CoreMenuItem[]) {
    const visibleMenus = menus.filter((item) => {
      if (item.visible == null) return true
      if (typeof item.visible === 'function') return item.visible()
      return item.visible
    })

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
