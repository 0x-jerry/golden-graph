import type { ICoordinate, IVec2 } from '@0x-jerry/golden-graph-protocol'
import { toReadonly } from './helper'
import type { IPersistent } from './Persistent'
import type { Workspace } from './Workspace'

export class CoordSystem implements IPersistent<ICoordinate> {
  _workspace?: Workspace

  _state = {
    x: 0,
    y: 0,
    scale: 1,
  }

  constructor(workspace?: Workspace) {
    this._workspace = workspace
  }

  get origin() {
    return toReadonly({
      x: this._state.x,
      y: this._state.y,
    })
  }

  get scale() {
    return this._state.scale
  }

  zoomAt(point: IVec2, scale: number) {
    const dx = point.x / scale - point.x / this.scale
    const dy = point.y / scale - point.y / this.scale

    this._state.x += dx
    this._state.y += dy

    this._state.scale = scale
    this._workspace?.events.emit('coord:changed', this)
  }

  reset() {
    this._state.x = 0
    this._state.y = 0
    this._state.scale = 1
    this._workspace?.events.emit('coord:changed', this)
  }

  move(x: number, y: number) {
    this._state.x += x / this.scale
    this._state.y += y / this.scale
    this._workspace?.events.emit('coord:changed', this)
  }

  /**
   * Convert coord system to screen system
   */
  convertToScreenCoord(pos: IVec2) {
    return {
      x: (this._state.x + pos.x) * this.scale,
      y: (this._state.y + pos.y) * this.scale,
    }
  }

  /**
   * Convert screen system to coord system
   */
  convertScreenCoord(pos: IVec2) {
    return {
      x: pos.x / this.scale - this._state.x,
      y: pos.y / this.scale - this._state.y,
    }
  }

  getCoordStyle(pos: IVec2) {
    const p = this.convertToScreenCoord(pos)

    return {
      '--x': `${p.x}px`,
      '--y': `${p.y}px`,
      '--scale': this.scale,
    }
  }

  toJSON(): ICoordinate {
    return {
      origin: {
        x: this._state.x,
        y: this._state.y,
      },
      scale: this._state.scale,
    }
  }

  fromJSON(data: ICoordinate): void {
    this._state.x = data.origin.x
    this._state.y = data.origin.y
    this._state.scale = data.scale
    this._workspace?.events.emit('coord:changed', this)
  }
}
