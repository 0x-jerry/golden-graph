import Konva from 'konva'
import {
  NODE_SHAPE,
  SUBGRAPH_TAG_WIDTH,
  SUBGRAPH_TAG_HEIGHT,
} from '../constants'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

const TAG_TEXT = 'Composite'

/** Marker tag drawn on the right of a SubGraphNode's header title. */
export class SubGraphTag extends Konva.Group {
  _bg: Konva.Rect
  _text: Konva.Text

  constructor(theme: GraphTheme = DEFAULT_THEME) {
    super({ name: NODE_SHAPE.TAG })

    const bg = new Konva.Rect({
      width: SUBGRAPH_TAG_WIDTH,
      height: SUBGRAPH_TAG_HEIGHT,
      cornerRadius: 3,
      fill: theme.colors.subgraphTagBg,
    })

    const text = new Konva.Text({
      text: TAG_TEXT,
      fontSize: theme.fonts.size - 2,
      fontFamily: theme.fonts.family,
      fill: theme.colors.subgraphTagText,
      width: SUBGRAPH_TAG_WIDTH,
      height: SUBGRAPH_TAG_HEIGHT,
      align: 'center',
      verticalAlign: 'middle',
    })

    this.add(bg, text)
    this._bg = bg
    this._text = text
  }

  applyTheme(theme: GraphTheme): void {
    this._bg.fill(theme.colors.subgraphTagBg)
    this._text.fill(theme.colors.subgraphTagText)
    this._text.fontFamily(theme.fonts.family)
    this._text.fontSize(theme.fonts.size - 2)
  }
}
