import { EventEmitter } from '@0x-jerry/utils'
import { reactive } from 'vue'
import { RectBox } from '../utils/RectBox'
import { toReadonly } from './helper'
import type { IDisposable } from './types'
import type { Workspace } from './Workspace'

export interface InteractiveEvents {
  'selection:start': []
  'selection:move': [rect: RectBox]
  'selection:end': []
}

export class Interactive implements IDisposable {
  readonly events = new EventEmitter<InteractiveEvents>()

  _state = reactive({
    shift: false,
    dragging: false,
  })

  _areaEl = document.createElement('div')

  _selection = {
    started: false,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  }

  get state() {
    return toReadonly(this._state)
  }

  constructor(readonly ws: Workspace) {
    this._areaEl.style.border = '1px solid rgba(41, 136, 237, 1)'
    this._areaEl.style.background = 'rgba(41, 136, 237, 0.2)'

    document.addEventListener('pointerup', this._onMouseUp)
    document.addEventListener('pointerdown', this._onMouseDown)
    document.addEventListener('pointermove', this._onMouseMove)
    document.addEventListener('keydown', this._onKeyDown)
    document.addEventListener('keyup', this._onKeyUp)
  }

  _onMouseDown = (evt: PointerEvent) => {
    if (!this._state.shift) {
      return
    }

    this._startSelection(evt)
  }

  _onMouseMove = (evt: PointerEvent) => {
    this._moveSelection(evt)
  }

  _onMouseUp = (evt: PointerEvent) => {
    this._endSelection(evt)
  }

  _onKeyDown = (e: KeyboardEvent) => {
    this._state.shift = e.shiftKey
  }

  _onKeyUp = (e: KeyboardEvent) => {
    this._state.shift = e.shiftKey
  }

  _startSelection(evt: PointerEvent) {
    this._selection.started = true
    this._selection.x1 = evt.clientX
    this._selection.y1 = evt.clientY

    this._selection.x2 = evt.clientX
    this._selection.y2 = evt.clientY

    document.body.append(this._areaEl)
    this.events.emit('selection:start')

    this._updateAreaStyle()
  }

  _moveSelection(evt: PointerEvent) {
    if (!this._selection.started) {
      return
    }

    this._selection.x2 = evt.clientX
    this._selection.y2 = evt.clientY

    this._updateAreaStyle()
  }

  _endSelection(_evt: PointerEvent) {
    if (!this._selection.started) {
      return
    }

    this._selection.started = false
    this._areaEl.remove()

    this.events.emit('selection:end')
  }

  _updateAreaStyle() {
    this._areaEl.style.position = 'fixed'
    this._areaEl.style.left = '0px'
    this._areaEl.style.top = '0px'

    const x = Math.min(this._selection.x1, this._selection.x2)
    const y = Math.min(this._selection.y1, this._selection.y2)
    const w = Math.abs(this._selection.x1 - this._selection.x2)
    const h = Math.abs(this._selection.y1 - this._selection.y2)

    this._areaEl.style.width = `${w}px`
    this._areaEl.style.height = `${h}px`

    this._areaEl.style.translate = `${x}px ${y}px`

    this.events.emit('selection:move', new RectBox(x, y, w, h))
  }

  dispose() {
    this._areaEl.remove()

    document.removeEventListener('pointerup', this._onMouseUp)
    document.removeEventListener('pointerdown', this._onMouseDown)
    document.removeEventListener('pointermove', this._onMouseMove)
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('keyup', this._onKeyUp)
  }
}
