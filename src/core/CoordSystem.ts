import { reactive } from 'vue'
import { toReadonly } from './helper'
import type { IPersistent } from './Persistent'
import type { ICoordinate, IVec2 } from './types'

export class CoordSystem implements IPersistent<ICoordinate> {
  /**
   * Coord system _state position
   */
  _state = reactive({
    x: 0,
    y: 0,
    scale: 1,
  })

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
  }

  move(x: number, y: number) {
    this._state.x += x / this.scale
    this._state.y += y / this.scale
  }

  /**
   * Covert coord system to screen system
   */
  convertToScreenCoord(pos: IVec2) {
    return {
      x: (this._state.x + pos.x) * this.scale,
      y: (this._state.y + pos.y) * this.scale,
    }
  }

  /**
   * Covert screen system to coord system
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
  }
}
