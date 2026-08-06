import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Select } from '../components/select'
import type { SelectOption } from '../components/select'
import { availableWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'

const INPUT_HEIGHT = 18

class SelectModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _select: Select

  constructor(handle: NodeHandle) {
    super()
    this._handle = handle

    this._select = new Select({
      selectWidth: availableWidth(handle),
      selectHeight: INPUT_HEIGHT,
      options: readOptions(handle),
      value: String(handle.getValue() ?? ''),
      fontSize: 12,
      onChange: (v) => {
        handle.setValue(v)
      },
    })
    this.add(this._select)
  }

  update(): void {
    this._select.setOptions(readOptions(this._handle))
    this._select.setValue(String(this._handle.getValue() ?? ''))
    this._select.setWidth(availableWidth(this._handle))
  }
}

export const selectHandleFactory: NodeHandleFactory = {
  type: 'select',
  create: (handle) => new SelectModule(handle),
}

function readOptions(handle: NodeHandle): (SelectOption | string)[] {
  return handle.getOptions().options ?? []
}
