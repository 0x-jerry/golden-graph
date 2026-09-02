import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Select } from '../components/select'
import type { SelectOption } from '../components/select'
import { availableWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

export interface NodeHandleOptions {
  options?: (SelectOption | string)[]
}

const INPUT_HEIGHT = 18

class SelectModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _select: Select

  constructor(handle: NodeHandle, theme: GraphTheme) {
    super()
    this._handle = handle

    this._select = new Select(
      {
        selectWidth: availableWidth(handle),
        selectHeight: INPUT_HEIGHT,
        options: readOptions(handle),
        value: String(handle.getValue() ?? ''),
        onChange: (v) => {
          handle.setValue(v)
        },
      },
      theme,
    )
    this.add(this._select)
  }

  update(): void {
    this._select.setOptions(readOptions(this._handle))
    this._select.setValue(String(this._handle.getValue() ?? ''))
    this._select.setWidth(availableWidth(this._handle))
  }

  applyTheme(theme: GraphTheme): void {
    this._select.applyTheme(theme)
  }
}

export const selectHandleFactory: NodeHandleFactory = {
  type: 'select',
  config: { joint: { color: '#f59e0b', shape: 'diamond' } },
  create: (handle, _options, theme) =>
      new SelectModule(handle, theme ?? DEFAULT_THEME),
}

function readOptions(handle: NodeHandle): (SelectOption | string)[] {
  return handle.getOptions<NodeHandleOptions>().options ?? []
}
