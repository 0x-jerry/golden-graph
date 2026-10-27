import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { RangeField } from '../components/numeric/RangeField'
import {
  numericFieldConfig,
  numericFieldOptions,
  readNumericOptions,
  type NumericHandleOptions,
} from './numericOptions'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

export interface NodeHandleOptions extends NumericHandleOptions {
  /**
   * Legacy option. The bar itself is the editable value box (double-click it
   * to type), so this no longer changes the widget; it is still accepted so
   * existing schemas keep loading.
   */
  showEditableValue?: boolean
}

/**
 * A ranged numeric handle drawn as a value bar beside its row label: the bar
 * fills to the current value (the progress display) and the chevrons on both
 * ends step it. Drag the bar to scrub, double-click it to type.
 */
class RangeModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _field: RangeField

  constructor(handle: NodeHandle, theme: GraphTheme) {
    super()
    this._handle = handle
    this._field = new RangeField(
      handle,
      numericFieldConfig(handle, 'range', readNumericOptions(handle)),
      theme,
    )
    this.add(this._field)
  }

  update(): void {
    const field = this._field
    const options = readNumericOptions(this._handle)
    // A live edit owns the value; everything else follows the handle.
    field.setOptions(numericFieldOptions('range', options))
    if (!field.editing) {
      field.refresh()
    }
    field.setWidth(numericFieldConfig(this._handle, 'range', options).width)
  }

  applyTheme(theme: GraphTheme): void {
    this._field.applyTheme(theme)
  }

  destroy(): this {
    this._field.destroy()
    return super.destroy()
  }
}

export const rangeHandleFactory: NodeHandleFactory = {
  type: 'range',
  config: { joint: { color: '#14b8a6', shape: 'triangle' } },
  create: (handle, _options, render) =>
    new RangeModule(handle, render?.theme ?? DEFAULT_THEME),
}
