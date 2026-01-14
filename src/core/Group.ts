import { shallowReactive } from "vue";
import type { IPersistent } from "./Persistent";
import type { IGroup, IVec2 } from "./types";
import { reactive } from "vue";
import type { Workspace } from "./Workspace";
import { offset } from "happy-dom/lib/PropertySymbol";
import { groupCollapsed } from "node:console";

export class Group implements IPersistent<IGroup> {
  id = 0

  _workspace?: Workspace

  readonly pos = shallowReactive({
    x: 0,
    y: 0
  })

  readonly size = shallowReactive({
    x: 0,
    y: 0,
  })

  readonly nodes = shallowReactive<number[]>([])

  _state = reactive({
    name: '',
  })

  get workspace() {
    if (!this._workspace) {
      throw new Error('Workspace is not set!')
    }

    return this._workspace
  }

  get name() {
    return this._state.name
  }

  get state() {
    return this._state
  }

  setWorkspace(workspace: Workspace) {
    this._workspace = workspace
  }

  setName(name: string) {
    this._state.name = name;
  }

  move(dPos: IVec2) {
    this.pos.x += dPos.x
    this.pos.y += dPos.y

    this.workspace.nodes.forEach(item => {
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
      nodes: this.nodes.slice()
    }
  }

  fromJSON(data: IGroup): void {
    this.id = data.id
    this._state.name = data.name

    this.pos.x = data.pos.x
    this.pos.y = data.pos.y

    this.size.x = data.size.x
    this.size.y = data.size.y

    this.nodes.splice(0)
    this.nodes.push(...data.nodes)
  }
}