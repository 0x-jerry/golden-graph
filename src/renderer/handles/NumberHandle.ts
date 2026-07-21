import Konva from 'konva'
import { Input } from '../components/Input'
import { availableWidth } from './utils'
import type { HandleModule } from './types'

export const type = 'number'

const INPUT_HEIGHT = 18

const inputMap = new WeakMap<Konva.Group, Input>()

function numberFilter(v: string): string {
  return v.replace(/[^0-9.-]/g, '')
}

export const create: HandleModule['create'] = (handle) => {
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
  inputMap.set(group, input)

  return group
}

export const update: HandleModule['update'] = (group, handle) => {
  const input = inputMap.get(group)
  if (input) {
    input.setValue(String(handle.getValue() ?? ''))
  }
}

export function dispose() {}
