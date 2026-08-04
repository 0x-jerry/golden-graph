import Konva from 'konva'
import type { Node, NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import {
  COLORS,
  LAYOUT,
  NODE_SHAPE,
  NODE_BODY_PADDING,
  RESIZE_HANDLE_SIZE,
  getNodeWidth,
  getNodeHeight,
  ELEMENT_TYPE,
  ATTR,
} from './constants'
import { HandleView } from './HandleView'
import { EntityView } from './EntityView'
import { renderResizeHandle } from './resizeHandle'

export class NodeView extends EntityView<Node> {
  _body: Konva.Rect
  _header: Konva.Rect
  _name: Konva.Text
  _resize: Konva.Group
  /** Rendered handle views keyed by handle key. */
  _handleViews = new Map<string, HandleView>()

  constructor(node: Node) {
    const width = getNodeWidth(node)
    const height = getNodeHeight(node)

    const g = new Konva.Group({
      x: node.pos.x,
      y: node.pos.y,
      name: ELEMENT_TYPE.NODE,
      [ATTR.ELEMENT_ID]: node.id,
    })

    const body = new Konva.Rect({
      width,
      height,
      fill: COLORS.BG,
      stroke: COLORS.BORDER,
      strokeWidth: 1,
      name: NODE_SHAPE.BODY,
    })
    g.add(body)

    const header = new Konva.Rect({
      width,
      height: LAYOUT.HEADER_HEIGHT,
      fill: COLORS.HEADER_BG,
      name: NODE_SHAPE.HEADER,
    })
    g.add(header)

    const nameText = new Konva.Text({
      text: node.name,
      fontSize: 13,
      fill: COLORS.TEXT_PRIMARY,
      x: 8,
      y: 7,
      width: width - 16,
      name: NODE_SHAPE.NAME,
    })
    g.add(nameText)

    super(node, g)
    this._body = body
    this._header = header
    this._name = nameText

    this._syncHandles()

    const resize = renderResizeHandle()
    resize.x(width - RESIZE_HANDLE_SIZE)
    resize.y(height - RESIZE_HANDLE_SIZE)
    g.add(resize)
    this._resize = resize
  }

  update(): void {
    const node = this.entity
    const group = this.group

    group.x(node.pos.x)
    group.y(node.pos.y)

    this._name.text(node.name)

    const width = getNodeWidth(node)
    const height = getNodeHeight(node)

    this._body.width(width)
    this._body.height(height)
    this._header.width(width)
    this._name.width(width - 16)

    this._resize.x(width - RESIZE_HANDLE_SIZE)
    this._resize.y(height - RESIZE_HANDLE_SIZE)

    this._syncHandles()
  }

  /** Reflect active-selection state: accent stroke + resize grip visibility. */
  setActive(isActive: boolean): void {
    this._body.stroke(isActive ? COLORS.ACCENT : COLORS.BORDER)
    this._resize.visible(isActive)
  }

  /** Highlight a node while the executor is running it. */
  setExecuteHighlight(isProcessing: boolean, isCurrent: boolean): void {
    if (isProcessing && isCurrent) {
      this._body.shadowColor(COLORS.ACCENT_SOFT)
      this._body.shadowBlur(EXECUTOR_SHADOW_BLUR)
      this._body.shadowOffset({ x: 0, y: 0 })
      this._body.shadowEnabled(true)
    } else {
      this._body.shadowEnabled(false)
    }
  }

  _syncHandles(): void {
    const node = this.entity

    // Destroy views for handles that no longer exist.
    for (const [key, view] of this._handleViews) {
      if (!node.handles.some((h) => h.key === key)) {
        view.destroy()
        this._handleViews.delete(key)
      }
    }

    // Add/update views to match the current handle list.
    node.handles.forEach((handle) => {
      const index = getHandleIndex(node, handle)
      if (index < 0) return

      let view = this._handleViews.get(handle.key)
      if (!view) {
        view = new HandleView(handle, index)
        this._handleViews.set(handle.key, view)
        this.group.add(view.group)
        return
      }
      view.update(index)
    })
  }

  destroy(): void {
    for (const view of this._handleViews.values()) {
      view.destroy()
    }
    this._handleViews.clear()
    super.destroy()
  }
}

export function computeNodeHeight(node: Node): number {
  const handleCount = node.handles.length || 1
  return (
    LAYOUT.HEADER_HEIGHT +
    handleCount * LAYOUT.HANDLE_ROW_HEIGHT +
    NODE_BODY_PADDING
  )
}

export function getHandleIndex(node: Node, handle: NodeHandle): number {
  const positioned = node.handles.filter((h) => h.position !== HandlePosition.None)
  const idx = positioned.indexOf(handle)
  if (idx >= 0) return idx

  const noneHandles = node.handles.filter((h) => h.position === HandlePosition.None)
  const noneIdx = noneHandles.indexOf(handle)
  if (noneIdx >= 0) return positioned.length + noneIdx

  return -1
}

const EXECUTOR_SHADOW_BLUR = 10