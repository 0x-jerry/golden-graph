import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Input } from '../components/input'
import { availableWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

const INPUT_HEIGHT = 18

class NumberModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _input: Input

  constructor(handle: NodeHandle, theme: GraphTheme) {
    super()
    this._handle = handle

    this._input = new Input(
      {
        inputWidth: availableWidth(handle),
        inputHeight: INPUT_HEIGHT,
        value: String(handle.getValue() ?? ''),
        beforeChange: numberFilter,
        onChange: (v) => {
          const num = v === '' ? NaN : Number(v)
          handle.setValue(Number.isNaN(num) ? undefined : num)
        },
      },
      theme,
    )
    this.add(this._input)
  }

  update(): void {
    this._input.setValue(String(this._handle.getValue() ?? ''))
    this._input.setWidth(availableWidth(this._handle))
  }

  applyTheme(theme: GraphTheme): void {
    this._input.applyTheme(theme)
  }
}

export const numberHandleFactory: NodeHandleFactory = {
  type: 'number',
  config: { joint: { color: '#6366f1', shape: 'circle' } },
  create: (handle, _options, theme) =>
      new NumberModule(handle, theme ?? DEFAULT_THEME),
}

function numberFilter(v: string): string {
  return v.replace(/[^0-9.-]/g, '')
}
