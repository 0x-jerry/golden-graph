import Konva from 'konva'
import { Input } from '../components/input'
import { availableWidth } from './utils'
import type { HandleModule } from './types'

const inputMap = new WeakMap<Konva.Group, Input>()

export const textHandle: HandleModule = {
  type: 'text',

  create: (handle) => {
    const group = new Konva.Group()
    const w = availableWidth(handle)

    const input = new Input({
      inputWidth: w,
      inputHeight: INPUT_HEIGHT,
      value: String(handle.getValue() ?? ''),
      fontSize: 12,
      onChange: (v) => {
        handle.setValue(v || undefined)
      },
    })
    group.add(input)
    inputMap.set(group, input)

    return group
  },

  update: (group, handle) => {
    const input = inputMap.get(group)
    if (input) {
      input.setValue(String(handle.getValue() ?? ''))
      input.setWidth(availableWidth(handle))
    }
  },

  destroy: (group) => {
    inputMap.delete(group)
  },
}

const INPUT_HEIGHT = 18
