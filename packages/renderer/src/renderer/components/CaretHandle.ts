import Konva from 'konva'
import { registerStageCursor } from '../cursor'
import { CARET_HIT_PADDING, CARET_SIZE, NODE_SHAPE } from '../constants'
import { DEFAULT_THEME } from '../../theme'
import type { GraphTheme } from '../../theme'

/**
 * Expand/collapse caret (chevron) in the node header. Points down while the
 * node is expanded (click to collapse), and rotated −90° (right ▸) while
 * collapsed (click to expand).
 *
 * Renders state only: `NodeView` passes an `onToggle` callback and drives the
 * chevron via {@link CaretHandle#setCollapsed}. The caret is named neither
 * HEADER nor NAME, so `InteractionManager._onPointerDown` never starts a node
 * drag from it.
 */
export class CaretHandle extends Konva.Group {
  _chevron: Konva.Line

  constructor(theme: GraphTheme = DEFAULT_THEME, onToggle?: () => void) {
    super({ name: NODE_SHAPE.CARET })

    const chevron = new Konva.Line({
      points: [-4, -3, 0, 1, 4, -3],
      stroke: theme.colors.textMuted,
      strokeWidth: 1.5,
      lineCap: 'round',
      lineJoin: 'round',
    })
    this.add(chevron)
    this._chevron = chevron

    // Invisible hit zone around the chevron so small clicks still land. With
    // a fill set, Konva hit-tests the rect; the chevron's own stroke is thin.
    const hitSize = CARET_SIZE + CARET_HIT_PADDING * 2
    const hit = new Konva.Rect({
      width: hitSize,
      height: hitSize,
      offsetX: hitSize / 2,
      offsetY: hitSize / 2,
      fill: 'transparent',
    })
    this.add(hit)

    registerStageCursor(this, 'pointer')

    if (onToggle) {
      // 'click' fires on the group when either child is hit (event bubbling).
      this.on('click', onToggle)
    }
  }

  /** Reflect the fold state: down ▾ while expanded, right ▸ while collapsed. */
  setCollapsed(collapsed: boolean): void {
    this.rotation(collapsed ? -90 : 0)
  }

  applyTheme(theme: GraphTheme): void {
    this._chevron.stroke(theme.colors.textMuted)
  }
}
