import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { LAYOUT, getNodeWidth } from '../constants'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

class DisplayModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _text: Konva.Text

  constructor(handle: NodeHandle, theme: GraphTheme) {
    super()
    this._handle = handle

    const text = new Konva.Text({
      name: 'value',
      text: String(handle.getValue() ?? ''),
      fontSize: theme.fonts.size,
      fontFamily: theme.fonts.family,
      fill: theme.colors.textMuted,
      width: displayWidth(handle),
      wrap: 'word',
    })
    this.add(text)
    this._text = text
  }

  update(): void {
    const text = this.findOne<Konva.Text>('.value')
    if (text) {
      text.text(String(this._handle.getValue() ?? ''))
      text.width(displayWidth(this._handle))
    }
  }

  applyTheme(theme: GraphTheme): void {
    this._text.fill(theme.colors.textMuted)
    this._text.fontFamily(theme.fonts.family)
    this._text.fontSize(theme.fonts.size)
  }
}

export const displayHandleFactory: NodeHandleFactory = {
  type: 'display',
  config: {
    layout: 'block',
    joint: { color: '#8b5cf6', shape: 'square' },
  },
  create: (handle, _options, theme) =>
      new DisplayModule(handle, theme ?? DEFAULT_THEME),
}

function displayWidth(handle: NodeHandle): number {
  return getNodeWidth(handle.node) - LAYOUT.HANDLE_PADDING * 2
}
