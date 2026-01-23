import { ensureArray } from '@0x-jerry/utils'
import { reactive, shallowReactive } from 'vue'
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
  /**
   * Default node type.
   */
  None = 0,
  /**
   * Executor should start from this node.
   */
  Entry = 1,
}

export class Node implements IPersistent<INode> {
  id = 0
  name = 'Node'
  description?: string

  _type = 'DefaultNode'
  _nodeType = NodeType.None

  _handles: NodeHandle[] = shallowReactive([])

  _state = reactive({
    pos: {
      x: 0,
      y: 0,
    },
  })

  _workspace?: Workspace

  _subGraphId?: number

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

  get subGraphId() {
    return this._subGraphId
  }

  setSubGraphId(subGraphId?: number) {
    this._subGraphId = subGraphId
  }

  /**
   * Get data of the node by key.
   * @param key The key of the data.
   * @returns The value by the key.
   */
  getData<T>(key: string): T | undefined {
    const handle = this.getHandle(key)

    if (!handle) {
      throw new Error(`Can not find handle by key: ${key}`)
    }

    return handle.getValue() as T
  }

  /**
   *
   * Get all real value of the node handles.
   *
   * @internal
   * @returns A deep clone of the node handles data.
   */
  getAllRealData() {
    const data: Record<string, unknown> = {}
    for (const handle of this.handles) {
      data[handle.key] = handle.getRealValue()
    }

    return structuredClone(data)
  }

  /**
   * Get all value of the node handles.
   * @returns A deep clone of the node handles data.
   */
  getAllData() {
    const data: Record<string, unknown> = {}
    for (const handle of this.handles) {
      data[handle.key] = this.getData(handle.key)
    }

    return structuredClone(data)
  }

  setData(key: string, value: unknown) {
    const handle = this.getHandle(key)

    if (!handle) {
      throw new Error(`Can not find handle by key: ${key}`)
    }

    handle.setValue(value)
  }

  setAllData(data: ObjectAny) {
    for (const key in data) {
      this.setData(key, data[key])
    }
  }

  isHandleConnected(key: string) {
    const handle = this.getHandle(key)

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
      this.setAllData(opt.data)
    }

    if (opt.pos) {
      this.moveTo(opt.pos.x, opt.pos.y)
    }
  }

  addHandle(conf: INodeHandleConfig) {
    const handle = new NodeHandle()
    handle.setNode(this)

    handle.fromConfig({
      ...conf,
      type: ensureArray(conf.type),
    })

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
      data: this.getAllRealData(),
      subGraphId: this._subGraphId,
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

    this.setAllData(data.data || {})

    this.setSubGraphId(data.subGraphId)
  }
}
