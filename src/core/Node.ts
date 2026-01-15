import { type Arrayable, ensureArray } from '@0x-jerry/utils'
import { shallowReactive, toRaw } from 'vue'
import type { HandlePosition } from './HandlePosition'
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
  _type = 'DefaultNode'
  _nodeType = NodeType.None

  id = 0
  name = 'Node'
  description?: string

  _data: Record<string, unknown> = shallowReactive({})

  _connectedData: Record<string, unknown> = shallowReactive({})

  readonly pos = shallowReactive({ x: 0, y: 0 })

  _handles: NodeHandle[] = shallowReactive([])

  _workspace?: Workspace

  get type() {
    return this._type
  }

  get nodeType() {
    return this._nodeType
  }

  get workspace() {
    if (!this._workspace) {
      throw new Error('Workspace is not set!')
    }

    return this._workspace
  }

  get handles() {
    return this._handles as readonly NodeHandle[]
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
    const handle = this.handles.find(n => n.key === key)

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
