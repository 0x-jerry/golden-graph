import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import {
  COLORS,
  LAYOUT,
  HANDLE_CONTENT_X,
  HANDLE_CONTENT_Y_OFFSET,
  HANDLE_NAME_WIDTH,
  HANDLE_NAME_GAP,
  BLOCK_HANDLE_LABEL_ROW,
  ELEMENT_TYPE,
  ATTR,
  getNodeWidth,
} from './constants'
import { getHandleFactory } from './handles'
import {
  clearMeasuredRowHeight,
  handleY,
  getHandleRowHeight,
  setMeasuredRowHeight,
} from './handles/layout'
import type {
  NodeHandleFactory,
  NodeHandleModule,
  HandleContentLayout,
} from './handles/types'

/** Label top padding inside a block handle's row. */
const BLOCK_LABEL_TOP_PAD = 3
/** Gap between the label and the content below it in a block handle. */
const BLOCK_LABEL_CONTENT_GAP = 4

/**
 * Registry mapping a core handle to its rendered view, used for cross-cutting
 * lookups (e.g. hit-testing / joint highlighting from the InteractionManager).
 * All per-handle state lives on the `HandleView` instance itself.
 */
const handleViewMap = new WeakMap<NodeHandle, HandleView>()

/** Registry mapping a handle's content group back to its view. */
const contentViewMap = new WeakMap<Konva.Group, HandleView>()

/**
 * Signal that a handle's content group resized asynchronously (e.g. an image
 * finished loading). Re-measures the block row and resizes the owning node.
 */
export function notifyContentResized(group: Konva.Group) {
  contentViewMap.get(group)?._onContentResized()
}

export class HandleView {
  readonly handle: NodeHandle
  readonly group: Konva.Group
  readonly key: string

  _joint?: Konva.Circle
  _label: Konva.Text
  _factory: NodeHandleFactory | null
  _module: NodeHandleModule | null = null
  _layout: HandleContentLayout
  _highlighted = false
  /** Fired after this handle's row height is re-measured. */
  _onResize?: () => void

  constructor(handle: NodeHandle, onResize?: () => void) {
    this.handle = handle
    this.key = handle.key
    this._onResize = onResize
    this._factory = getHandleFactory(handle.type) ?? null
    this._layout = this._factory?.config?.layout ?? 'inline'

    const group = new Konva.Group({
      name: ELEMENT_TYPE.HANDLE,
      [ATTR.ELEMENT_ID]: handle.key,
    })
    this.group = group

    const y = handleY(handle.node, handle)
    const rowTop = this._blockRowTop(y)

    if (
      handle.position === HandlePosition.Left ||
      handle.position === HandlePosition.Right
    ) {
      const circle = new Konva.Circle({
        x:
          handle.position === HandlePosition.Left
            ? 0
            : getNodeWidth(handle.node),
        y,
        radius: LAYOUT.JOINT_RADIUS,
        fill: this._jointFill(),
        stroke: COLORS.BORDER,
        strokeWidth: 1,
        name: ELEMENT_TYPE.JOINT,
      })
      group.add(circle)
      this._joint = circle
    }

    const label = new Konva.Text({
      name: 'label',
      text: handle.name,
      fontSize: 12,
      fill: COLORS.TEXT_LABEL,
      // Fixed-width name column: keeps handle contents aligned across rows.
      // Handles without a name reserve no space (auto width = 0).
      width: handle.name ? HANDLE_NAME_WIDTH : undefined,
      wrap: 'none',
      ellipsis: true,
    })
    label.x(labelX(handle))
    if (handle.position === HandlePosition.Right) {
      label.align('right')
    }
    if (this._layout === 'block') {
      label.y(rowTop + BLOCK_LABEL_TOP_PAD)
      label.offsetY(0)
    } else {
      label.offsetY(label.height() / 2)
      label.y(y)
    }
    group.add(label)
    this._label = label

    if (this._factory) {
      const module = this._factory.create(handle, handle.getOptions())
      module.name('content')
      module.y(this._contentY())
      this._layoutContent(module)
      group.add(module)
      this._module = module
      contentViewMap.set(module, this)
    }

    handleViewMap.set(handle, this)

    // Measure the block content and re-position using the final row height.
    this._measureRowHeight()
    this.update()
  }

  update(): void {
    const y = handleY(this.handle.node, this.handle)
    const rowTop = this._blockRowTop(y)

    const joint = this._joint
    if (joint) {
      joint.y(y)
      joint.x(
        this.handle.position === HandlePosition.Left
          ? 0
          : getNodeWidth(this.handle.node),
      )
      joint.fill(this._jointFill())
    }

    this._label.y(this._layout === 'block' ? rowTop + BLOCK_LABEL_TOP_PAD : y)
    this._label.x(labelX(this.handle))

    const module = this._module
    module?.update?.()
    if (module) {
      // Re-layout after the module may have changed its own size
      // (e.g. width follows the node width).
      this._layoutContent(module)
      module.y(this._contentY())
    }

    // Measure after the module re-rendered its content, so the row reflects
    // the current value (wrapped text height, image size, ...).
    this._measureRowHeight()
  }

  setJointHighlight(highlighted: boolean): void {
    this._highlighted = highlighted
    this._joint?.fill(this._jointFill())
  }

  destroy(): void {
    handleViewMap.delete(this.handle)
    clearMeasuredRowHeight(this.handle)
    const module = this._module
    if (module) {
      contentViewMap.delete(module)
      module.destroy()
    }
    this.group.destroy()
  }

  _measureRowHeight(): void {
    if (this._layout !== 'block') {
      return
    }
    const contentHeight = this._module
      ? this._module.getClientRect({ skipTransform: true }).height
      : 0
    const minHeight = this._factory?.config?.minHeight ?? LAYOUT.HANDLE_ROW_HEIGHT
    const rowHeight =
      BLOCK_HANDLE_LABEL_ROW + Math.max(minHeight, contentHeight)
    setMeasuredRowHeight(this.handle, rowHeight)
  }

  _onContentResized(): void {
    this._measureRowHeight()
    this._onResize?.()
  }

  _jointFill(): string {
    if (this._highlighted) {
      return COLORS.JOINT_HIGHLIGHT
    }
    return this.handle.isConnected ? COLORS.ACCENT : COLORS.JOINT_DEFAULT
  }

  _blockRowTop(rowCenterY: number): number {
    return this._layout === 'block'
      ? rowCenterY - getHandleRowHeight(this.handle) / 2
      : rowCenterY
  }

  _contentY(): number {
    if (this._layout === 'block') {
      return this._label.y() + this._label.height() + BLOCK_LABEL_CONTENT_GAP
    }
    return handleY(this.handle.node, this.handle) - HANDLE_CONTENT_Y_OFFSET
  }

  _layoutContent(content: Konva.Group): void {
    if (this._layout === 'block') {
      const w = getNodeWidth(this.handle.node)
      if (this.handle.position === HandlePosition.Right) {
        content.x(w - HANDLE_CONTENT_X)
        // Local-space width: `getClientRect()` without `skipTransform` would
        // include the stage zoom, shifting right-aligned content on resize.
        content.offsetX(content.getClientRect({ skipTransform: true }).width)
      } else if (this.handle.position === HandlePosition.Left) {
        content.x(HANDLE_CONTENT_X)
        content.offsetX(0)
      } else {
        content.x(LAYOUT.HANDLE_PADDING)
        content.offsetX(0)
      }
      return
    }

    const nameWidth = this._label.width()
    content.x(contentX(this.handle, nameWidth))
    if (this.handle.position === HandlePosition.Right) {
      // Local-space width: `getClientRect()` without `skipTransform` would
      // include the stage zoom, shifting right-aligned content on resize.
      content.offsetX(content.getClientRect({ skipTransform: true }).width)
    } else {
      content.offsetX(0)
    }
  }
}

export function getHandleView(handle: NodeHandle): HandleView | undefined {
  return handleViewMap.get(handle)
}

/**
 * Highlight / un-highlight a joint during a connection drag. The highlight
 * survives `update` calls (which otherwise re-derive the fill from the
 * connection state) until explicitly cleared or the handle view is destroyed.
 */
export function setJointHighlight(handle: NodeHandle, highlighted: boolean) {
  handleViewMap.get(handle)?.setJointHighlight(highlighted)
}

function labelX(handle: NodeHandle): number {
  if (handle.position === HandlePosition.Right) {
    return getNodeWidth(handle.node) - HANDLE_CONTENT_X - HANDLE_NAME_WIDTH
  }
  return handle.position === HandlePosition.Left
    ? HANDLE_CONTENT_X
    : LAYOUT.HANDLE_PADDING
}

function contentX(handle: NodeHandle, nameWidth: number): number {
  const nameGap = nameWidth > 0 ? HANDLE_NAME_GAP : 0
  if (handle.position === HandlePosition.Right) {
    return getNodeWidth(handle.node) - HANDLE_CONTENT_X - nameWidth - nameGap
  }
  if (handle.position === HandlePosition.Left) {
    return HANDLE_CONTENT_X + nameWidth + nameGap
  }
  return LAYOUT.HANDLE_PADDING + nameWidth + nameGap
}
