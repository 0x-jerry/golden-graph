import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Select } from '../components/select'
import type { SelectOptionInput } from '../components/select'
import { availableWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

export interface NodeHandleOptions {
  options?: SelectOptionInput[]
}

const INPUT_HEIGHT = 18

class SelectModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _select: Select

  constructor(handle: NodeHandle, theme: GraphTheme, animations: boolean) {
    super()
    this._handle = handle

    this._select = new Select(
      {
        selectWidth: availableWidth(handle),
        selectHeight: INPUT_HEIGHT,
        options: readOptions(handle),
        value: String(handle.getValue() ?? ''),
        animations,
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
    if (!this._select.active) {
      this._select.setValue(String(this._handle.getValue() ?? ''))
    }
    this._select.setWidth(availableWidth(this._handle))
  }

  applyTheme(theme: GraphTheme): void {
    this._select.applyTheme(theme)
  }
}

export const selectHandleFactory: NodeHandleFactory = {
  type: 'select',
  config: { joint: { color: '#f59e0b', shape: 'diamond' } },
  create: (handle, _options, render) =>
    new SelectModule(
      handle,
      render?.theme ?? DEFAULT_THEME,
      render?.animations ?? true,
    ),
}

function readOptions(handle: NodeHandle): SelectOptionInput[] {
  return handle.getOptions<NodeHandleOptions>().options ?? []
}
