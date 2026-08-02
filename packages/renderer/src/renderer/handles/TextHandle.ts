import Konva from 'konva'
import { Input } from '../components/input'
import { availableWidth } from './utils'
import type { HandleModule } from './types'

export const type = 'text'

const INPUT_HEIGHT = 18

const inputMap = new WeakMap<Konva.Group, Input>()

export const create: HandleModule['create'] = (handle) => {
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
}

export const update: HandleModule['update'] = (group, handle) => {
  const input = inputMap.get(group)
  if (input) {
    input.setValue(String(handle.getValue() ?? ''))
    input.setWidth(availableWidth(handle))
  }
}

export function dispose() {}
