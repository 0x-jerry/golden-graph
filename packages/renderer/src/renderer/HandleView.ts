import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { ELEMENT_TYPE, ATTR, JOINT_CURSOR, getNodeWidth } from './constants'
import { registerStageCursor } from './cursor'
import { getHandleFactory } from './handles'
import {
  clearMeasuredRowHeight,
  contentY,
  handleY,
  isBlockHandle,
  measureHandleRow,
} from './handles/layout'
import { contentX, labelWidth, labelX } from './handles/placement'
import type { NodeHandleFactory, NodeHandleModule } from './handles/types'
import {
  createJointShape,
  paintJoint,
  resolveJointStyle,
  setJointStyle,
} from './joint'
import { Tooltip } from './tooltip'
import { DEFAULT_THEME } from '../theme'
import type { GraphTheme } from '../theme'

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
 * finished loading). Re-measures the block row and re-lays out the owning
 * node. Content is contained to the node's size — it can re-fit into the
 * available box but never expands the node.
 */
export function notifyContentResized(group: Konva.Group) {
  contentViewMap.get(group)?._onContentResized()
}

/**
 * Renders one handle row — joint, label and content widget — and keeps it in
 * sync with the handle's node, theme and connection state. Row geometry lives
 * in `handles/layout` and `handles/placement`, joint visuals in `joint`,
 * tooltip lifecycle in {@link Tooltip}.
 */
export class HandleView {
  readonly handle: NodeHandle
  readonly group: Konva.Group
  readonly key: string

  _joint?: Konva.Shape
  _label: Konva.Text
  _factory: NodeHandleFactory | null
  _module: NodeHandleModule | null = null
  _highlighted = false
  /** Fired after this handle's row height is re-measured. */
  _onResize?: () => void
  /** Description tooltip; present only for handles that have one. */
  _tooltip?: Tooltip
  /** Active theme, re-applied on hot-swap via `applyTheme`. */
  _theme: GraphTheme

  constructor(
    handle: NodeHandle,
    onResize?: () => void,
    theme: GraphTheme = DEFAULT_THEME,
  ) {
    this.handle = handle
    this._theme = theme
    this.key = handle.key
    this._onResize = onResize
    this._factory = getHandleFactory(handle.type) ?? null

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
      this._createJoint(theme, y)
    }
    this._label = this._createLabel(theme, y)

    const factory = this._factory
    if (factory?.create) {
      const module = factory.create(handle, handle.getOptions(), theme)
      module.name('content')
      module.y(contentY(handle))
      this._layoutContent(module)
      group.add(module)
      this._module = module
      contentViewMap.set(module, this)
    }

    handleViewMap.set(handle, this)

    if (handle.description) {
      this._tooltip = new Tooltip(group, {
        text: handle.description,
        // The anchor must sit at the handle row — the joint, or the label for
        // layout-only handles — since the group lives at the node's origin.
        anchor: () => this._joint ?? this._label,
        // Right-positioned handles grow their tooltip leftward from the joint
        // so it stays over the handle instead of hanging off the node's edge.
        align: handle.position === HandlePosition.Right ? 'end' : 'start',
      })
    }

    // Measure the block content and re-position using the final row height.
    this._measureRowHeight()
    this.update()
  }

  update(): void {
    const handle = this.handle
    const y = handleY(handle.node, handle)

    const joint = this._joint
    if (joint) {
      joint.y(y)
      joint.x(
        handle.position === HandlePosition.Left
          ? 0
          : getNodeWidth(handle.node),
      )
      this._applyJointStyle()
    }

    this._label.y(y)
    this._label.x(labelX(handle))
    // A full-width label tracks the node width across resizes; unnamed
    // handles keep their auto width.
    const width = labelWidth(handle)
    if (width !== undefined) {
      this._label.width(width)
    }

    const module = this._module
    module?.update?.()
    if (module) {
      // Re-layout after the module may have changed its own size
      // (e.g. width follows the node width).
      this._layoutContent(module)
      module.y(contentY(handle))
    }

    // Measure after the module re-rendered its content, so the row reflects
    // the current value (wrapped text height, image size, ...).
    this._measureRowHeight()
  }

  setJointHighlight(highlighted: boolean): void {
    this._highlighted = highlighted
    this._applyJointStyle()
  }

  destroy(): void {
    handleViewMap.delete(this.handle)
    clearMeasuredRowHeight(this.handle)
    this._tooltip?.destroy()
    const module = this._module
    if (module) {
      contentViewMap.delete(module)
      module.destroy()
    }
    this.group.destroy()
  }

  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    const joint = this._joint
    if (joint) {
      setJointStyle(joint, resolveJointStyle(this.handle, theme))
      this._applyJointStyle()
    }
    this._label.fill(theme.colors.textLabel)
    this._label.fontFamily(theme.fonts.family)
    this._label.fontSize(theme.fonts.size)
    // Re-center: the label's y is the row center, so offset half its own
    // (possibly re-measured) height after the size change.
    this._label.offsetY(this._label.height() / 2)
    this._module?.applyTheme?.(theme)
  }

  _createJoint(theme: GraphTheme, y: number): void {
    const handle = this.handle
    const joint = createJointShape(resolveJointStyle(handle, theme))
    joint.position({
      x:
        handle.position === HandlePosition.Left
          ? 0
          : getNodeWidth(handle.node),
      y,
    })
    joint.name(ELEMENT_TYPE.JOINT)
    registerStageCursor(joint, JOINT_CURSOR)
    this.group.add(joint)
    this._joint = joint
    this._applyJointStyle()
  }

  _createLabel(theme: GraphTheme, y: number): Konva.Text {
    const handle = this.handle
    const label = new Konva.Text({
      name: 'label',
      text: handle.name,
      // Unnamed handles reserve no name column and render nothing.
      visible: handle.name !== '',
      fontSize: theme.fonts.size,
      fontFamily: theme.fonts.family,
      fill: theme.colors.textLabel,
      width: labelWidth(handle),
      wrap: 'none',
      ellipsis: true,
    })
    label.x(labelX(handle))
    if (handle.position === HandlePosition.Right) {
      label.align('right')
    }
    label.offsetY(label.height() / 2)
    label.y(y)
    this.group.add(label)
    return label
  }

  _applyJointStyle(): void {
    const joint = this._joint
    if (joint) {
      paintJoint(joint, this.handle, this._theme, this._highlighted)
    }
  }

  _measureRowHeight(): void {
    if (!isBlockHandle(this.handle)) {
      return
    }
    const contentHeight = this._module
      ? this._module.getClientRect({ skipTransform: true }).height
      : 0
    measureHandleRow(this.handle, contentHeight)
  }

  _onContentResized(): void {
    this._measureRowHeight()
    this._onResize?.()
  }

  _layoutContent(content: Konva.Group): void {
    content.x(contentX(this.handle, this._label.width()))
    // Right-positioned content is right-anchored: shift the group left by its
    // own width so the box ends at the origin. Local-space width —
    // `getClientRect()` without `skipTransform` would include the stage zoom,
    // shifting right-aligned content on resize.
    content.offsetX(
      this.handle.position === HandlePosition.Right
        ? content.getClientRect({ skipTransform: true }).width
        : 0,
    )
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
