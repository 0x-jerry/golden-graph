import { type Arrayable, ensureArray } from '@0x-jerry/utils'
import { shallowReactive } from 'vue'
import { type INodeHandleConfig, NodeHandle } from './NodeHandle'
import type { IPersistent } from './Persistent'
import type { INode, IVec2, ObjectAny } from './types'
import type { Workspace } from './Workspace'

export interface NodeBaseUpdateOptions {
  name?: string
  pos?: IVec2
  description?: string
  data?: ObjectAny
}

export interface INodeHandleOptions extends Omit<INodeHandleConfig, 'type'> {
  value?: any
  type: Arrayable<string>
}

export class Node implements IPersistent<INode> {
  _type = 'DefaultNode'

  id = 0
  name = 'Node'
  description?: string

  _data: Record<string, unknown> = shallowReactive({})

  readonly pos = shallowReactive({ x: 0, y: 0 })

  _handles: NodeHandle[] = shallowReactive([])

  _workspace?: Workspace

  get workspace() {
    if (!this._workspace) {
      throw new Error('Workspace is not set!')
    }

    return this._workspace
  }

  get handles() {
    return this._handles as readonly NodeHandle[]
  }

  getData<T>(key: string): T | undefined {
    return this._data[key] as T | undefined
  }

  setData(key: string, value: unknown) {
    this._data[key] = value
  }

  setWorkspace(w: Workspace) {
    this._workspace = w
  }

  updateByOption<T extends NodeBaseUpdateOptions>(opt: T) {
    if (opt.name) {
      this.name = opt.name
    }

    if (opt.description) {
      this.description = opt.description
    }

    if (opt.data) {
      Object.assign(this._data, opt.data)
    }

    if (opt.pos) {
      this.moveTo(opt.pos.x, opt.pos.y)
    }
  }

  addHandle(conf: INodeHandleOptions) {
    const handle = new NodeHandle()
    handle.fromConfig({
      ...conf,
      type: ensureArray(conf.type),
    })

    handle.setNode(this)

    if (conf.value !== undefined) {
      this.setData('value', conf.value)
    }

    this._handles.push(handle)
  }

  getHandle(key: string) {
    return this.handles.find((n) => n.key === key)
  }

  onProcess?: (instance: this) => unknown

  move(x: number, y: number) {
    this.pos.x += x
    this.pos.y += y
  }

  moveTo(x: number, y: number) {
    this.pos.x = x
    this.pos.y = y
  }

  toJSON(): INode {
    return {
      id: this.id,
      type: this._type,
      data: this._data,
      pos: {
        x: this.pos.x,
        y: this.pos.y,
      },
    }
  }

  fromJSON(data: INode): void {
    this.id = data.id
    this.pos.x = data.pos.x
    this.pos.y = data.pos.y

    Object.assign(this._data, data.data)
  }
}
