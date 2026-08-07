import Konva from 'konva'
import type { Node, NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition, isSubGraphNode } from '@0x-jerry/golden-graph'
import {
  COLORS,
  LAYOUT,
  NODE_SHAPE,
  NODE_BODY_PADDING,
  RESIZE_HANDLE_SIZE,
  getNodeWidth,
  ELEMENT_TYPE,
  ATTR,
} from './constants'
import { getHandleRowHeight } from './handles/layout'
import { HandleView } from './HandleView'
import { EntityView } from './EntityView'
import { ResizeHandle } from './components/ResizeHandle'

export class NodeView extends EntityView<Node> {
  _body: Konva.Rect
  _header: Konva.Rect
  _name: Konva.Text
  _resize: ResizeHandle
  /** SubGraph marker tag rendered in the header, absent for normal nodes. */
  _tag?: Konva.Group
  /** Rendered handle views keyed by handle key. */
  _handleViews = new Map<string, HandleView>()
  /** `size.y` last written by `_syncNodeHeight`, or `null` when hands-off. */
  _autoY: number | null = null

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

    if (isSubGraphNode(node)) {
      const tag = createSubGraphTag()
      tag.x(width - SUBGRAPH_TAG_WIDTH - 8)
      tag.y(Math.round((LAYOUT.HEADER_HEIGHT - SUBGRAPH_TAG_HEIGHT) / 2))
      g.add(tag)
      this._tag = tag

      // Leave room on the right so the tag never overlaps the title.
      nameText.width(width - 16 - SUBGRAPH_TAG_WIDTH - 4)
    }

    this._syncHandles()

    // Fix the body height now that handle views have measured their rows
    // (block content can grow past the static minimum).
    const measuredHeight = getNodeHeight(node)
    this._body.height(measuredHeight)

    const resize = new ResizeHandle()
    resize.x(width - RESIZE_HANDLE_SIZE)
    resize.y(measuredHeight - RESIZE_HANDLE_SIZE)
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
    this._header.width(width)

    if (this._tag) {
      // Leave room on the right so the tag never overlaps the title.
      this._name.width(width - 16 - SUBGRAPH_TAG_WIDTH - 4)
      this._tag.x(width - SUBGRAPH_TAG_WIDTH - 8)
      this._tag.y(Math.round((LAYOUT.HEADER_HEIGHT - SUBGRAPH_TAG_HEIGHT) / 2))
    } else {
      this._name.width(width - 16)
    }

    // Re-measure handle rows first so the body/grip use the final height
    // (block content can grow/shrink past the static minimum).
    this._syncHandles()

    const height = getNodeHeight(node)
    this._body.width(width)
    this._body.height(height)

    this._resize.x(width - RESIZE_HANDLE_SIZE)
    this._resize.y(height - RESIZE_HANDLE_SIZE)

    this._syncNodeHeight()
  }

  /**
   * Keep `size.y` in sync with the content-driven height: grow when content
   * overflows, shrink when it shrinks — but never shrink below a height the
   * user set manually (`size.y` no longer equals our last write).
   */
  _syncNodeHeight(): void {
    const node = this.entity
    const content = getNodeContentHeight(node)
    const current = node.size.y

    if (current !== this._autoY) {
      // Something else (manual resize) changed `size.y` since our last write.
      if (content > current) {
        this._writeAutoHeight(content)
      } else {
        this._autoY = null
      }
      return
    }

    if (content !== this._autoY) {
      this._writeAutoHeight(content)
    }
  }

  _writeAutoHeight(y: number): void {
    const node = this.entity
    node.setSize({ x: node.size.x, y })
    this._autoY = y
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

      // Rebuild the view when the handle object was replaced (e.g. a
      // SubGraphNode rebuilt by `buildNode()`): layout helpers match handles
      // by identity, so a stale handle would mis-position the row.
      if (view && view.handle !== handle) {
        view.destroy()
        this._handleViews.delete(handle.key)
        view = undefined
      }

      if (!view) {
        view = new HandleView(handle, () => this._syncNodeHeight())
        this._handleViews.set(handle.key, view)
        this.group.add(view.group)
        return
      }
      view.update()
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

/**
 * Content-driven node height (header + handle rows + padding), using measured
 * block row heights when live handle views exist.
 */
export function getNodeContentHeight(node: Node): number {
  let contentHeight = LAYOUT.HEADER_HEIGHT + NODE_BODY_PADDING
  for (const handle of node.handles) {
    contentHeight += getHandleRowHeight(handle)
  }
  return contentHeight
}

/**
 * Effective node height. Never smaller than the content-driven height
 * (header + handle rows + padding), even when `size.y` is set.
 */
export function getNodeHeight(node: Node): number {
  return Math.max(node.size.y, getNodeContentHeight(node))
}

export function getHandleIndex(node: Node, handle: NodeHandle): number {
  const positioned = node.handles.filter(
    (h) => h.position !== HandlePosition.None,
  )
  const idx = positioned.indexOf(handle)
  if (idx >= 0) return idx

  const noneHandles = node.handles.filter(
    (h) => h.position === HandlePosition.None,
  )
  const noneIdx = noneHandles.indexOf(handle)
  if (noneIdx >= 0) return positioned.length + noneIdx

  return -1
}

const EXECUTOR_SHADOW_BLUR = 10

const SUBGRAPH_TAG_TEXT = 'Composite'
const SUBGRAPH_TAG_WIDTH = 56
const SUBGRAPH_TAG_HEIGHT = 16

/** Marker tag drawn on the right of a SubGraphNode's header title. */
function createSubGraphTag(): Konva.Group {
  const tag = new Konva.Group({ name: NODE_SHAPE.TAG })

  const bg = new Konva.Rect({
    width: SUBGRAPH_TAG_WIDTH,
    height: SUBGRAPH_TAG_HEIGHT,
    cornerRadius: 3,
    fill: COLORS.SUBGRAPH_TAG_BG,
  })

  const text = new Konva.Text({
    text: SUBGRAPH_TAG_TEXT,
    fontSize: 10,
    fill: COLORS.SUBGRAPH_TAG_TEXT,
    width: SUBGRAPH_TAG_WIDTH,
    height: SUBGRAPH_TAG_HEIGHT,
    align: 'center',
    verticalAlign: 'middle',
  })

  tag.add(bg, text)

  return tag
}
