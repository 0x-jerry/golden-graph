import { toReadonly } from './helper'
import type { NodeHandle } from './NodeHandle'
import type { IPersistent } from './Persistent'
import type { IEdge, INodeHandleLoc } from './types'
import type { Workspace } from './Workspace'

export class Edge implements IPersistent<IEdge> {
  id = 0

  type = 'default'

  _start?: NodeHandle
  _end?: NodeHandle

  _workspace?: Workspace

  get start() {
    return toReadonly(this._start!)
  }

  get end() {
    return toReadonly(this._end!)
  }

  get workspace() {
    if (!this._workspace) {
      throw new Error('Workspace is not set!')
    }
    return toReadonly(this._workspace)
  }

  setWorkspace(workspace: Workspace) {
    this._workspace = workspace
  }

  setEndpoints(start: NodeHandle, end: NodeHandle) {
    this._start = start
    this._end = end
    start.setConnectedHandle(end)
    end.setConnectedHandle(start)
  }

  clearEndpoints() {
    this._start?.setConnectedHandle()
    this._end?.setConnectedHandle()
  }

  toJSON(): IEdge {
    return {
      id: this.id,
      type: this.type,
      start: {
        id: this.start.node.id,
        key: this.start.key,
      },
      end: {
        id: this.end.node.id,
        key: this.end.key,
      },
    }
  }

  fromJSON(data: IEdge): void {
    this.id = data.id
    this.type = data.type

    const start = this._getHandleInstance(data.start)
    const end = this._getHandleInstance(data.end)

    this.setEndpoints(start, end)
  }

  _getHandleInstance(handleLoc: INodeHandleLoc) {
    const node = this.workspace.getNode(handleLoc.id)

    const handle = node?.getHandle(handleLoc.key)

    if (!handle) {
      throw new Error(
        `Can not find handle by node id ${handleLoc.id} and key ${handleLoc.key}`,
      )
    }

    return handle
  }
}
