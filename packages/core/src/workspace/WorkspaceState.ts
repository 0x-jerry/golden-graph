import { type Arrayable, ensureArray } from '@0x-jerry/utils'
import type { Workspace } from './Workspace'

export enum ActiveType {
  None = 0,
  Node = 1,
  Group = 2,
  Edge = 3,
}

/**
 * Selection (`activeIds` / `activeType`) and debug flag of a workspace.
 *
 * The mutable data object lives on the {@link Workspace} (`_state`); this
 * manager owns the mutations and emits `state:changed` through the
 * workspace event bus.
 */
export class WorkspaceState {
  constructor(readonly ws: Workspace) {}

  setActiveIds(type: ActiveType, ids: Arrayable<number>) {
    const _ids = ensureArray(ids)
    const state = this.ws._state

    const alreadyIncluded =
      type === state.activeType &&
      _ids.length === state.activeIds.length &&
      _ids.every((id) => state.activeIds.includes(id))

    if (alreadyIncluded) {
      return
    }

    state.activeIds = _ids
    state.activeType = type
    this.ws.events.emit('state:changed', state)
  }

  isActive(id: number) {
    return this.ws._state.activeIds.includes(id)
  }

  clearActiveIds() {
    this.setActiveIds(ActiveType.None, [])
  }

  setDebug(enabled: boolean) {
    this.ws._state.debug = enabled
    this.ws.events.emit('state:changed', this.ws._state)
  }
}
