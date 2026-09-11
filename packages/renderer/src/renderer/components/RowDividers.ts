import Konva from 'konva'
import type { Node } from '@0x-jerry/golden-graph'
import { LAYOUT, NODE_SHAPE, getNodeWidth } from '../constants'
import { getHandleOrder, getHandleRowHeight } from '../handles/layout'
import type { GraphTheme, NodeCornerRadius } from '../../theme'

/**
 * Pooled separators between handle rows. Positions come from the same row
 * layout the handle views use, so they track measured block content.
 */
export class RowDividers extends Konva.Group {
  _lines: Konva.Line[] = []

  constructor() {
    super({ listening: false })
  }

  sync(node: Node, theme: GraphTheme, bodyRadius: NodeCornerRadius): void {
    const visible = !node.collapsed && theme.colors.rowDivider !== ''
    const order = getHandleOrder(node)

    const count = visible ? Math.max(0, order.length - 1) : 0
    while (this._lines.length < count) {
      const line = new Konva.Line({
        strokeWidth: 1,
        name: NODE_SHAPE.ROW_DIVIDER,
      })
      this._lines.push(line)
      this.add(line)
    }

    const width = getNodeWidth(node)
    const inset = dividerInset(bodyRadius, width)
    let y = LAYOUT.HEADER_HEIGHT
    for (let i = 0; i < count; i++) {
      y += getHandleRowHeight(order[i]!)
      this._lines[i]!.points([inset, y, width - inset, y]).visible(true)
    }
    for (let i = count; i < this._lines.length; i++) {
      this._lines[i]!.visible(false)
    }
  }

  applyTheme(theme: GraphTheme): void {
    for (const line of this._lines) {
      line.stroke(theme.colors.rowDivider)
    }
  }
}

/**
 * Horizontal inset keeping a row separator inside a rounded silhouette. The
 * exact chord depends on how far the boundary sits from the arc, so this is a
 * deliberately conservative half-radius approximation.
 */
function dividerInset(radius: NodeCornerRadius, width: number): number {
  const max = Array.isArray(radius) ? Math.max(0, ...radius) : radius
  return Math.min(max / 2, width / 2)
}
