import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Input } from '../components/input'
import { filterNumericText, stepValue } from '../numeric'
import { availableWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

const INPUT_HEIGHT = 18

export interface NodeHandleOptions {
  /** Amount ArrowUp/ArrowDown add or subtract. Defaults to `1`. */
  step?: number
}

class NumberModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _input: Input
  _step: number

  constructor(handle: NodeHandle, theme: GraphTheme) {
    super()
    this._handle = handle
    this._step = readStep(handle)

    this._input = new Input(
      {
        inputWidth: availableWidth(handle),
        inputHeight: INPUT_HEIGHT,
        value: String(handle.getValue() ?? ''),
        beforeChange: filterNumericText,
        onChange: (v) => {
          const num = v === '' ? NaN : Number(v)
          handle.setValue(Number.isNaN(num) ? undefined : num)
        },
        onStep: (delta) => this._stepBy(delta),
      },
      theme,
    )
    this.add(this._input)
  }

  _stepBy(delta: number) {
    const current = Number(this._input.getValue())
    const base = Number.isNaN(current) ? 0 : current
    this._input.setValue(String(stepValue(base, this._step, delta)))
  }

  update(): void {
    if (!this._input.active) {
      this._input.setValue(String(this._handle.getValue() ?? ''))
    }
    this._input.setWidth(availableWidth(this._handle))
  }

  applyTheme(theme: GraphTheme): void {
    this._input.applyTheme(theme)
  }
}

export const numberHandleFactory: NodeHandleFactory = {
  type: 'number',
  config: { joint: { color: '#6366f1', shape: 'circle' } },
  create: (handle, _options, render) =>
      new NumberModule(handle, render?.theme ?? DEFAULT_THEME),
}

function readStep(handle: NodeHandle): number {
  const step = Number(handle.getOptions<NodeHandleOptions>().step ?? 1)
  return Number.isFinite(step) && step > 0 ? step : 1
}
