import Konva from 'konva'
import { Input } from '../components/input'
import { availableWidth } from './utils'
import { HandleModule } from './types'

export class NumberHandle extends HandleModule {
  static type = 'number'

  _inputMap = new WeakMap<Konva.Group, Input>()

  create: HandleModule['create'] = (handle) => {
    const group = new Konva.Group()
    const w = availableWidth(handle)

    const input = new Input({
      inputWidth: w,
      inputHeight: INPUT_HEIGHT,
      value: String(handle.getValue() ?? ''),
      fontSize: 12,
      beforeChange: numberFilter,
      onChange: (v) => {
        const num = v === '' ? NaN : Number(v)
        handle.setValue(Number.isNaN(num) ? undefined : num)
      },
    })
    group.add(input)
    this._inputMap.set(group, input)

    return group
  }

  update: HandleModule['update'] = (group, handle) => {
    const input = this._inputMap.get(group)
    if (input) {
      input.setValue(String(handle.getValue() ?? ''))
      input.setWidth(availableWidth(handle))
    }
  }

  destroy: HandleModule['destroy'] = (group) => {
    this._inputMap.delete(group)
  }
}

const INPUT_HEIGHT = 18

function numberFilter(v: string): string {
  return v.replace(/[^0-9.-]/g, '')
}