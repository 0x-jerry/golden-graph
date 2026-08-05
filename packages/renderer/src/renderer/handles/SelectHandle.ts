import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Select } from '../components/select'
import type { SelectOption } from '../components/select'
import { availableWidth } from './utils'
import { HandleModule } from './types'

export class SelectHandle extends HandleModule {
  static type = 'select'

  _selectMap = new WeakMap<Konva.Group, Select>()

  create: HandleModule['create'] = (handle) => {
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
    this._selectMap.set(group, select)

    return group
  }

  update: HandleModule['update'] = (group, handle) => {
    const select = this._selectMap.get(group)
    if (select) {
      select.setOptions(readOptions(handle))
      select.setValue(String(handle.getValue() ?? ''))
      select.setWidth(availableWidth(handle))
    }
  }

  destroy: HandleModule['destroy'] = (group) => {
    this._selectMap.delete(group)
  }
}

const INPUT_HEIGHT = 18

function readOptions(handle: NodeHandle): (SelectOption | string)[] {
  return handle.getOptions().options ?? []
}