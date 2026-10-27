import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { NumberField } from '../components/numeric/NumberField'
import {
  numericFieldConfig,
  numericFieldOptions,
  readNumericOptions,
} from './numericOptions'
import type { NumericHandleOptions } from './numericOptions'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

export type NodeHandleOptions = NumericHandleOptions

/**
 * A numeric handle drawn as a value bar beside its row label: drag the bar to
 * scrub the value, double-click it to type. A value outside `[min, max]`
 * grows a chevron at the bound it fell past.
 */
class NumberModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _field: NumberField

  constructor(handle: NodeHandle, theme: GraphTheme) {
    super()
    this._handle = handle
    this._field = new NumberField(
      handle,
      numericFieldConfig(handle, 'number', readNumericOptions(handle)),
      theme,
    )
    this.add(this._field)
  }

  update(): void {
    const field = this._field
    const options = readNumericOptions(this._handle)
    // A live edit owns the value; everything else follows the handle.
    field.setOptions(numericFieldOptions('number', options))
    if (!field.editing) {
      field.refresh()
    }
    field.setWidth(numericFieldConfig(this._handle, 'number', options).width)
  }

  applyTheme(theme: GraphTheme): void {
    this._field.applyTheme(theme)
  }

  destroy(): this {
    this._field.destroy()
    return super.destroy()
  }
}

export const numberHandleFactory: NodeHandleFactory = {
  type: 'number',
  config: { joint: { color: '#6366f1', shape: 'circle' } },
  create: (handle, _options, render) =>
    new NumberModule(handle, render?.theme ?? DEFAULT_THEME),
}
