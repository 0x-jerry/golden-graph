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
  ELEMENT_TYPE,
  ATTR,
  getNodeWidth,
} from './constants'
import { getHandleModule } from './handles'
import type { HandleModule } from './handles/types'

/**
 * Registry mapping a core handle to its rendered view, used for cross-cutting
 * lookups (e.g. hit-testing / joint highlighting from the InteractionManager).
 * All per-handle state lives on the `HandleView` instance itself.
 */
const handleViewMap = new WeakMap<NodeHandle, HandleView>()

export class HandleView {
  readonly handle: NodeHandle
  readonly group: Konva.Group
  readonly key: string

  _joint?: Konva.Circle
  _label: Konva.Text
  _content?: Konva.Group
  _module: HandleModule | null
  _highlighted = false

  constructor(handle: NodeHandle, index: number) {
    this.handle = handle
    this.key = handle.key
    this._module = getHandleModule(handle.getOptions().type) ?? null

    const group = new Konva.Group({
      name: ELEMENT_TYPE.HANDLE,
      [ATTR.ELEMENT_ID]: handle.key,
    })
    this.group = group

    if (
      handle.position === HandlePosition.Left ||
      handle.position === HandlePosition.Right
    ) {
      const circle = new Konva.Circle({
        x: handle.position === HandlePosition.Left ? 0 : getNodeWidth(handle.node),
        y: handleY(index),
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
      fill: COLORS.TEXT_MUTED,
      y: handleY(index),
      // Fixed-width name column: keeps handle contents aligned across rows.
      // Handles without a name reserve no space (auto width = 0).
      width: handle.name ? HANDLE_NAME_WIDTH : undefined,
      wrap: 'none',
      ellipsis: true,
    })
    label.offsetY(label.height() / 2)
    label.x(labelX(handle))
    if (handle.position === HandlePosition.Right) {
      label.align('right')
    }
    group.add(label)
    this._label = label

    if (this._module) {
      const contentGroup = this._module.create(handle, handle.getOptions())
      contentGroup.name('content')
      contentGroup.y(handleY(index) - HANDLE_CONTENT_Y_OFFSET)
      this._layoutContent(contentGroup)
      group.add(contentGroup)
      this._content = contentGroup
    }

    handleViewMap.set(handle, this)
  }

  update(index: number): void {
    const joint = this._joint
    if (joint) {
      joint.y(handleY(index))
      joint.x(this.handle.position === HandlePosition.Left ? 0 : getNodeWidth(this.handle.node))
      joint.fill(this._jointFill())
    }

    this._label.y(handleY(index))
    this._label.x(labelX(this.handle))

    const content = this._content
    const module = this._module
    if (module?.update && content) {
      module.update(content, this.handle)
      // Re-layout after the module may have changed its own size
      // (e.g. width follows the node width).
      this._layoutContent(content)
    }
  }

  setJointHighlight(highlighted: boolean): void {
    this._highlighted = highlighted
    this._joint?.fill(this._jointFill())
  }

  destroy(): void {
    handleViewMap.delete(this.handle)
    const content = this._content
    if (content && this._module?.destroy) {
      this._module.destroy(content, this.handle)
    }
    this.group.destroy()
  }

  _jointFill(): string {
    if (this._highlighted) {
      return COLORS.JOINT_HIGHLIGHT
    }
    return this.handle.isConnected ? COLORS.ACCENT : COLORS.JOINT_DEFAULT
  }

  _layoutContent(content: Konva.Group): void {
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

function handleY(index: number): number {
  return (
    LAYOUT.HEADER_HEIGHT +
    index * LAYOUT.HANDLE_ROW_HEIGHT +
    LAYOUT.HANDLE_ROW_HEIGHT / 2
  )
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