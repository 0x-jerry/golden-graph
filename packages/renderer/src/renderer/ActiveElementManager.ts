import type { Stage } from 'konva/lib/Stage'
import type { IDisposable } from '@0x-jerry/golden-graph'
import type { KonvaPointerEvent } from 'konva/lib/PointerEvents'
import type { Node as KonvaNode } from 'konva/lib/Node'

export interface IActiveElement extends KonvaNode {
  deactivate(): void
}

export class ActiveElementManager implements IDisposable {
  static key = 'active-element-manager'

  _current: IActiveElement | null = null
  _stage: Stage

  constructor(stage: Stage) {
    this._stage = stage
  }

  _onClickStage = (e: KonvaPointerEvent) => {
    if (!this._current) return

    const hit = e.target.findAncestor((s: any) => s === this._current)

    if (!hit) {
      this.set(null)
    }
  }

  _onDocMousedown = (e: Event) => {
    const s = this._stage.getContent()

    if (!s.contains(e.target as Node)) {
      this.set(null)
    }
  }

  init() {
    this._stage.on('click tap', this._onClickStage)
    document.addEventListener('mousedown', this._onDocMousedown)
  }

  dispose(): void {
    this._stage.off('click tap', this._onClickStage)
    document.removeEventListener('mousedown', this._onDocMousedown)
  }

  get() {
    return this._current
  }

  set(element: IActiveElement | null) {
    if (this._current === element) return
    const prev = this._current
    this._current = element
    prev?.deactivate()
  }
}
