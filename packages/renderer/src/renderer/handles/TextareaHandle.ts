import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Textarea, LINE_HEIGHT_RATIO } from '../components/text'
import { DEFAULT_FONT_SIZE, PADDING } from '../components/shared'
import { blockContentWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

const TEXTAREA_LINES = 3
export const TEXTAREA_MIN_HEIGHT =
  Math.round(TEXTAREA_LINES * DEFAULT_FONT_SIZE * LINE_HEIGHT_RATIO) +
  PADDING * 2

class TextareaModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _textarea: Textarea

  constructor(handle: NodeHandle, theme: GraphTheme) {
    super()
    this._handle = handle

    this._textarea = new Textarea(
      {
        inputWidth: blockContentWidth(handle),
        inputHeight: TEXTAREA_MIN_HEIGHT,
        value: String(handle.getValue() ?? ''),
        onChange: (v) => {
          handle.setValue(v || undefined)
        },
      },
      theme,
    )
    this.add(this._textarea)
  }

  update(): void {
    if (!this._textarea.active) {
      this._textarea.setValue(String(this._handle.getValue() ?? ''))
    }
    this._textarea.resize(blockContentWidth(this._handle), TEXTAREA_MIN_HEIGHT)
  }

  applyTheme(theme: GraphTheme): void {
    this._textarea.applyTheme(theme)
  }
}

export const textareaHandleFactory: NodeHandleFactory = {
  type: 'textarea',
  config: {
    layout: 'block',
    minHeight: TEXTAREA_MIN_HEIGHT,
    joint: { color: '#0ea5e9', shape: 'square' },
  },
  create: (handle, _options, theme) =>
    new TextareaModule(handle, theme ?? DEFAULT_THEME),
}
