import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Select } from '../components/select'
import type { SelectOption } from '../components/select'
import { availableWidth } from './utils'
import type { HandleModule } from './types'

const selectMap = new WeakMap<Konva.Group, Select>()

export const selectHandle: HandleModule = {
  type: 'select',

  create: (handle) => {
    const group = new Konva.Group()
    const w = availableWidth(handle)

    const select = new Select({
      selectWidth: w,
      selectHeight: INPUT_HEIGHT,
      options: readOptions(handle),
      value: String(handle.getValue() ?? ''),
      fontSize: 12,
      onChange: (v) => {
        handle.setValue(v)
      },
    })
    group.add(select)
    selectMap.set(group, select)

    return group
  },

  update: (group, handle) => {
    const select = selectMap.get(group)
    if (select) {
      select.setOptions(readOptions(handle))
      select.setValue(String(handle.getValue() ?? ''))
      select.setWidth(availableWidth(handle))
    }
  },

  destroy: (group) => {
    selectMap.delete(group)
  },
}

const INPUT_HEIGHT = 18

function readOptions(handle: NodeHandle): (SelectOption | string)[] {
  return handle.getOptions().options ?? []
}
