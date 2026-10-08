import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { RangeSlider } from '../components/RangeSlider'
import { availableWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

export interface NodeHandleOptions {
  /** Slider lower bound. Defaults to `0`. */
  min?: number
  /** Slider upper bound. Defaults to `100`. */
  max?: number
  /** Amount the thumb snaps to. Defaults to `1`. */
  step?: number
  /** Show the editable value box beside the track. Defaults to `true`. */
  showEditableValue?: boolean
}

class RangeModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _slider: RangeSlider

  constructor(handle: NodeHandle, theme: GraphTheme) {
    super()
    this._handle = handle

    this._slider = new RangeSlider(
      {
        rangeWidth: availableWidth(handle),
        value: readValue(handle),
        ...readOptions(handle),
        onChange: (value) => {
          handle.setValue(value)
        },
      },
      theme,
    )
    this.add(this._slider)
  }

  update(): void {
    this._slider.setOptions(readOptions(this._handle))
    // Skip while dragging so unrelated node updates cannot revert the thumb.
    if (!this._slider.pressed) {
      this._slider.setValue(readValue(this._handle), true)
    }
    this._slider.setWidth(availableWidth(this._handle))
  }

  applyTheme(theme: GraphTheme): void {
    this._slider.applyTheme(theme)
  }
}

export const rangeHandleFactory: NodeHandleFactory = {
  type: 'range',
  config: { joint: { color: '#14b8a6', shape: 'triangle' } },
  create: (handle, _options, theme) =>
    new RangeModule(handle, theme ?? DEFAULT_THEME),
}

function readOptions(handle: NodeHandle): NodeHandleOptions {
  return handle.getOptions<NodeHandleOptions>()
}

/** A finite number or numeric string; anything else renders at `min`. */
function readValue(handle: NodeHandle): number | undefined {
  const raw = handle.getValue()
  if (raw === undefined || raw === null || raw === '') {
    return undefined
  }
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}
