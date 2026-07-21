import Konva from 'konva'
import { COLORS } from '../constants'
import { setActiveElement, deactivateActiveElement } from './active'
import type { IActiveElement } from './active'
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  type BaseFormConfig,
} from './shared'

export abstract class FormElement extends Konva.Group implements IActiveElement {
  declare _fs: number
  declare _ff: string
  declare _borderColor: string

  declare _keydownFn: (e: KeyboardEvent) => void
  declare _stageClickFn: (e: Konva.KonvaEventObject<MouseEvent>) => void
  declare _docClickFn: (e: MouseEvent) => void

  declare protected _active: boolean

  constructor(config: BaseFormConfig) {
    const {
      fontSize = DEFAULT_FONT_SIZE,
      fontFamily = DEFAULT_FONT_FAMILY,
      stroke = COLORS.BORDER,
      ...rest
    } = config
    super(rest)

    this._fs = fontSize
    this._ff = fontFamily
    this._borderColor = stroke
    this._active = false

    this._keydownFn = this._onKeyDown.bind(this)
    this._stageClickFn = () => {
      if (this._active) this._onStageClick()
    }
    this._docClickFn = (e: MouseEvent) => {
      if (!this._active) return
      const stage = this.getStage()
      if (!stage) return
      if (!stage.container().contains(e.target as globalThis.Node)) {
        this._onOutsideClick()
      }
    }
  }

  protected _bindEvents(): void {
    const stage = this.getStage()
    if (stage) {
      stage.on('click tap', this._stageClickFn)
      const container = stage.container()
      container.setAttribute('tabindex', '0')
      container.focus()
    }
    window.addEventListener('keydown', this._keydownFn)
    document.addEventListener('mousedown', this._docClickFn, true)
  }

  protected _unbindEvents(): void {
    window.removeEventListener('keydown', this._keydownFn)
    document.removeEventListener('mousedown', this._docClickFn, true)
    const stage = this.getStage()
    if (stage) {
      stage.off('click tap', this._stageClickFn)
    }
  }

  protected _activate(): void {
    if (this._active) return
    this._active = true
    setActiveElement(this as unknown as IActiveElement)
    this._bindEvents()
  }

  protected _deactivate(): void {
    if (!this._active) return
    this._active = false
    this._unbindEvents()
    deactivateActiveElement(this as unknown as IActiveElement)
  }

  protected abstract _onKeyDown(e: KeyboardEvent): void
  protected abstract _onStageClick(): void
  protected abstract _onOutsideClick(): void

  deactivate(): void {
    this._deactivate()
  }

  destroy(): this {
    if (this._active) {
      this._deactivate()
    }
    return super.destroy()
  }
}
