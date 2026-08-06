import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Input } from '../components/input'
import { availableWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'

const INPUT_HEIGHT = 18

class NumberModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _input: Input

  constructor(handle: NodeHandle) {
    super()
    this._handle = handle

    this._input = new Input({
      inputWidth: availableWidth(handle),
      inputHeight: INPUT_HEIGHT,
      value: String(handle.getValue() ?? ''),
      fontSize: 12,
      beforeChange: numberFilter,
      onChange: (v) => {
        const num = v === '' ? NaN : Number(v)
        handle.setValue(Number.isNaN(num) ? undefined : num)
      },
    })
    this.add(this._input)
  }

  update(): void {
    this._input.setValue(String(this._handle.getValue() ?? ''))
    this._input.setWidth(availableWidth(this._handle))
  }
}

export const numberHandleFactory: NodeHandleFactory = {
  type: 'number',
  create: (handle) => new NumberModule(handle),
}

function numberFilter(v: string): string {
  return v.replace(/[^0-9.-]/g, '')
}
