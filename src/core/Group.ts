import { reactive, shallowReactive } from 'vue'
import { toReadonly } from './helper'
import type { IPersistent } from './Persistent'
import { SubGraph } from './SubGraph'
import type { IGroup, IVec2 } from './types'
import type { Workspace } from './Workspace'

export class Group implements IPersistent<IGroup> {
  id = 0

  _workspace?: Workspace

  readonly nodes = shallowReactive<number[]>([])

  _state = reactive({
    name: 'Untitled',
    pos: {
      x: 0,
      y: 0,
    },
    size: {
      x: 0,
      y: 0,
    },
  })

  get pos() {
    return toReadonly(this._state.pos)
  }

  get size() {
    return toReadonly(this._state.size)
  }

  get workspace() {
    if (!this._workspace) {
      throw new Error('Workspace is not set!')
    }

    return toReadonly(this._workspace)
  }

  get name() {
    return this._state.name
  }

  get state() {
    return toReadonly(this._state)
  }

  setWorkspace(workspace: Workspace) {
    this._workspace = workspace
  }

  setName(name: string) {
    this._state.name = name
  }

  setPos(pos: IVec2) {
    this._state.pos.x = pos.x
    this._state.pos.y = pos.y
  }

  setSize(size: IVec2) {
    this._state.size.x = size.x
    this._state.size.y = size.y
  }

  move(dPos: IVec2) {
    this._state.pos.x += dPos.x
    this._state.pos.y += dPos.y

    this.workspace.nodes.forEach((item) => {
      if (this.nodes.includes(item.id)) {
        item.move(dPos.x, dPos.y)
      }
    })
  }

  toJSON(): IGroup {
    return {
      id: this.id,
      name: this.name,
      pos: { ...this.pos },
      size: { ...this.size },
      nodes: this.nodes.slice(),
    }
  }

  fromJSON(data: IGroup): void {
    this.id = data.id
    this._state.name = data.name

    this._state.pos.x = data.pos.x
    this._state.pos.y = data.pos.y

    this._state.size.x = data.size.x
    this._state.size.y = data.size.y

    this.nodes.splice(0)
    this.nodes.push(...data.nodes)
  }
}
