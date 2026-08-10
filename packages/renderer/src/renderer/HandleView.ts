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
  JOINT_CURSOR,
  getNodeWidth,
} from './constants'
import { resetStageCursor, setStageCursor } from './cursor'
import { getHandleFactory } from './handles'
import { createJointShape, resolveJointStyle } from './joint'
import {
  clearMeasuredRowHeight,
  getHandleRowHeight,
  hasLabelRow,
  handleY,
  setMeasuredRowHeight,
} from './handles/layout'
import type {
  NodeHandleFactory,
  NodeHandleModule,
  HandleContentLayout,
} from './handles/types'

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

  _joint?: Konva.Shape
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

    if (
      handle.position === HandlePosition.Left ||
      handle.position === HandlePosition.Right
    ) {
      const joint = createJointShape(resolveJointStyle(handle))
      joint.position({
        x:
          handle.position === HandlePosition.Left
            ? 0
            : getNodeWidth(handle.node),
        y,
      })
      joint.fill(this._jointFill())
      joint.stroke(COLORS.BORDER)
      joint.strokeWidth(1)
      joint.name(ELEMENT_TYPE.JOINT)
      joint.on('mouseover pointerover', () =>
        setStageCursor(joint, JOINT_CURSOR),
      )
      joint.on('mouseout pointerout', () => resetStageCursor(joint))
      group.add(joint)
      this._joint = joint
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
    label.offsetY(label.height() / 2)
    label.y(y)
    group.add(label)
    this._label = label

    if (this._factory?.create) {
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

    this._label.y(y)
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
    // Release the cursor if the pointer rests on the joint at teardown — no
    // `mouseout` fires without pointer movement. Must precede the group destroy.
    if (this._joint) {
      resetStageCursor(this._joint)
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
    const minHeight =
      this._factory?.config?.minHeight ?? LAYOUT.HANDLE_ROW_HEIGHT
    const content = Math.max(minHeight, contentHeight)
    const rowHeight = hasLabelRow(this.handle)
      ? BLOCK_HANDLE_LABEL_ROW + content
      : content
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
    return resolveJointStyle(this.handle).color
  }

  _blockRowTop(rowCenterY: number): number {
    if (this._layout !== 'block') {
      return rowCenterY
    }
    return hasLabelRow(this.handle)
      ? rowCenterY - BLOCK_HANDLE_LABEL_ROW / 2
      : rowCenterY - getHandleRowHeight(this.handle) / 2
  }

  _contentY(): number {
    if (this._layout === 'block') {
      const blockTop = this._blockRowTop(handleY(this.handle.node, this.handle))
      return hasLabelRow(this.handle)
        ? blockTop + BLOCK_HANDLE_LABEL_ROW
        : blockTop
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
