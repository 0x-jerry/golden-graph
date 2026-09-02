import Konva from 'konva'
import { setActiveElement } from './active'
import type { BaseFormConfig } from './shared'
import type { IActiveElement } from '../ActiveElementManager'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

export abstract class FormElement
  extends Konva.Group
  implements IActiveElement
{
  _fs: number
  _ff: string
  _borderColor: string
  /** Whether the caller pinned an explicit border color (else theme border). */
  _borderExplicit: boolean
  /** Whether the caller pinned an explicit background (else theme bg). */
  _fillExplicit: boolean
  /** Caller-pinned background, kept across hot-swaps when explicit. */
  _fill: string
  /** Active theme; subclasses re-apply themed chrome in `applyTheme`. */
  _theme: GraphTheme

  protected _active = false

  _keydownFn = this._onKeyDown.bind(this)

  constructor(config: BaseFormConfig, theme: GraphTheme = DEFAULT_THEME) {
    const {
      fontSize = theme.fonts.size,
      fontFamily = theme.fonts.family,
      stroke,
      fill,
      ...rest
    } = config
    super(rest)

    this._theme = theme
    this._fs = fontSize
    this._ff = fontFamily
    this._borderExplicit = stroke !== undefined
    this._borderColor = stroke ?? theme.colors.border
    this._fillExplicit = fill !== undefined
    this._fill = fill ?? theme.colors.bg
  }

  /** Re-apply theme-derived fonts + default border/background. */
  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    this._fs = theme.fonts.size
    this._ff = theme.fonts.family
    if (!this._borderExplicit) {
      this._borderColor = theme.colors.border
    }
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
    // `deactivate()` is idempotent (guarded by `_active`) and runs the full
    // teardown: `_deactivate()` + `_unbindEvents()` + reset `_active`.
    this.deactivate()
    return super.destroy()
  }
}
