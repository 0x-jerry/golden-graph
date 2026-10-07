import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { ScrollArea } from '../components/scroll'
import { getBlockContentMaxHeight } from './layout'
import { blockContentWidth } from './utils'
import type { NodeHandleFactory, NodeHandleModule } from './types'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

const TOP_PADDING = 6

class DisplayModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle
  _text: Konva.Text
  _scrollArea: ScrollArea

  constructor(handle: NodeHandle, theme: GraphTheme) {
    super()
    this._handle = handle

    const width = blockContentWidth(handle)

    this._scrollArea = new ScrollArea({
      width,
      height: getBlockContentMaxHeight(handle.node, handle),
      theme,
      wheelStep: theme.fonts.size + 6,
    })
    this.add(this._scrollArea)

    const text = new Konva.Text({
      name: 'value',
      text: String(handle.getValue() ?? ''),
      fontSize: theme.fonts.size,
      fontFamily: theme.fonts.family,
      fill: theme.colors.textMuted,
      width,
      wrap: 'word',
      y: TOP_PADDING,
      listening: false,
    })
    this._scrollArea.content.add(text)
    this._text = text
    this._sync()
  }

  update(): void {
    this._text.text(String(this._handle.getValue() ?? ''))
    this._sync()
  }

  _sync(): void {
    const width = blockContentWidth(this._handle)
    const height = getBlockContentMaxHeight(this._handle.node, this._handle)
    this._text.width(width)
    this._scrollArea.resize(width, height)
    this._scrollArea.setContentHeight(this._text.height() + TOP_PADDING * 2)  }

  applyTheme(theme: GraphTheme): void {
    this._text.fill(theme.colors.textMuted)
    this._text.fontFamily(theme.fonts.family)
    this._text.fontSize(theme.fonts.size)
    this._scrollArea.applyTheme(theme)
    this._sync()
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
