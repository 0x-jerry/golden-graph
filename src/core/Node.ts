import { type Arrayable, ensureArray } from '@0x-jerry/utils'
import { reactive, shallowReactive, toRaw } from 'vue'
import type { HandlePosition } from './HandlePosition'
import { toReadonly } from './helper'
import { type INodeHandleConfig, NodeHandle } from './NodeHandle'
import type { IPersistent } from './Persistent'
import type { INode, IVec2, ObjectAny } from './types'
import type { Workspace } from './Workspace'

export interface NodeBaseUpdateOptions {
  pos?: IVec2
  data?: ObjectAny
}

export enum NodeType {
  None = 0,
  Entry = 1,
}

export interface INodeHandleOptions extends Omit<INodeHandleConfig, 'type'> {
  value?: any
  type?: Arrayable<string>
}

export class Node implements IPersistent<INode> {
  id = 0
  name = 'Node'
  description?: string

  _type = 'DefaultNode'
  _nodeType = NodeType.None

  _data: Record<string, unknown> = shallowReactive({})

  _connectedData: Record<string, unknown> = shallowReactive({})

  _handles: NodeHandle[] = shallowReactive([])

  _state = reactive({
    pos: {
      x: 0,
      y: 0,
    },
  })

  _workspace?: Workspace

  get type() {
    return this._type
  }

  get nodeType() {
    return this._nodeType
  }

  get pos() {
    return toReadonly(this._state.pos)
  }

  get workspace() {
    if (!this._workspace) {
      throw new Error('Workspace is not set!')
    }

    return toReadonly(this._workspace)
  }

  get handles() {
    return toReadonly(this._handles)
  }

  /**
   * Get data of the node by key.
   * @param key The key of the data.
   * @returns The value by the key.
   */
  getData<T>(key: string): T | undefined {
    return this._data[key] as T | undefined
  }

  /**
   * Get all data of the node.
   * @returns A deep clone of the node data.
   */
  getAllData() {
    return structuredClone(toRaw(this._data))
  }

  setData(key: string, value: unknown) {
    if (this._data[key] === value) {
      return
    }

    this._data[key] = value
  }

  /**
   * @internal
   */
  setConnectedData(key: string, value: unknown) {
    this._connectedData[key] = value
  }

  isHandleConnected(key: string) {
    const handle = this.handles.find((n) => n.key === key)

    if (!handle?.isLeft) {
      return false
    }

    return !!this.workspace.queryEdges(handle.loc).length
  }

  setNodeType(t: NodeType) {
    this._nodeType = t
  }

  setWorkspace(w: Workspace) {
    this._workspace = w
  }

  updateByOption<T extends NodeBaseUpdateOptions>(opt: T) {
    if (opt.data) {
      Object.assign(this._data, opt.data)
    }

    if (opt.pos) {
      this.moveTo(opt.pos.x, opt.pos.y)
    }
  }

  addHandle(conf: INodeHandleOptions) {
    const handle = new NodeHandle()
    handle.setNode(this)

    handle.fromConfig({
      ...conf,
      type: ensureArray(conf.type),
    })

    if (conf.value !== undefined) {
      this.setData(handle.key, conf.value)
    }

    this._handles.push(handle)
  }

  getHandle(key: string) {
    return this.handles.find((n) => n.key === key)
  }

  queryHandles(position: HandlePosition) {
    return this.handles.filter((n) => n.position === position)
  }

  onProcess?: (instance: this) => unknown

  move(x: number, y: number) {
    this._state.pos.x += x
    this._state.pos.y += y
  }

  moveTo(x: number, y: number) {
    this._state.pos.x = x
    this._state.pos.y = y
  }

  toJSON(): INode {
    return {
      id: this.id,
      type: this._type,
      data: this._data,
      pos: {
        x: this._state.pos.x,
        y: this._state.pos.y,
      },
    }
  }

  fromJSON(data: INode): void {
    this.id = data.id
    this._state.pos.x = data.pos.x
    this._state.pos.y = data.pos.y

    Object.assign(this._data, data.data)
  }
}
