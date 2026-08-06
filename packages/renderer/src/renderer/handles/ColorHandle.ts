import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { ColorPicker, PRESET_COLORS } from '../components/color'
import { availableWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'

export interface NodeHandleOptions {
  shape?: 'circle' | 'rect'
  colors?: string[]
}

class ColorModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _picker: ColorPicker

  constructor(handle: NodeHandle) {
    super()
    this._handle = handle

    const options = handle.getOptions<NodeHandleOptions>()

    this._picker = new ColorPicker({
      pickerWidth: availableWidth(handle),
      value: normalizeColor(handle.getValue()),
      shape: options.shape ?? 'circle',
      colors: options.colors ?? PRESET_COLORS,
      // Preview picks live, but only commit the value to the handle once the
      // picker is dismissed.
      onCommit: (color) => {
        handle.setValue(color)
      },
    })
    this.add(this._picker)
  }

  update(): void {
    // Sync in silence so a non-hex external value is only normalized for
    // display and not written back to the handle via `onChange`. Skip while the
    // picker is open so an in-progress pick is not reverted to the committed
    // value by unrelated node updates (drag/resize).
    if (!this._picker.active) {
      this._picker.setValue(normalizeColor(this._handle.getValue()), true)
    }
    this._picker.setWidth(availableWidth(this._handle))
  }
}

export const colorHandleFactory: NodeHandleFactory = {
  type: 'color',
  create: (handle) => new ColorModule(handle),
}

function normalizeColor(value: unknown): string {
  if (typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return value
  }
  return '#ffffff'
}
