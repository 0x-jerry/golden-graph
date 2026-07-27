import Konva from 'konva'
import { COLORS } from '../constants'
import { setActiveElement } from './active'
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  type BaseFormConfig,
} from './shared'
import type { IActiveElement } from '../ActiveElementManager'

export abstract class FormElement
  extends Konva.Group
  implements IActiveElement
{
  _fs: number
  _ff: string
  _borderColor: string

  protected _active = false

  _keydownFn = this._onKeyDown.bind(this)

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
  }

  protected _bindEvents(): void {
    window.addEventListener('keydown', this._keydownFn)
  }

  protected _unbindEvents(): void {
    window.removeEventListener('keydown', this._keydownFn)
  }

  protected _activate(): void {
    if (this._active) return
    this._active = true
    this._bindEvents()

    setActiveElement(this as unknown as IActiveElement)
  }

  protected abstract _deactivate(): void

  protected abstract _onKeyDown(e: KeyboardEvent): void

  deactivate(): void {
    if (!this._active) return
    this._deactivate()
    this._unbindEvents()

    this._active = false
  }

  destroy(): this {
    if (this._active) {
      this._deactivate()
    }
    return super.destroy()
  }
}
