import Konva from 'konva'
import type { Node, NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition, isSubGraphNode } from '@0x-jerry/golden-graph'
import {
  COLORS,
  LAYOUT,
  NODE_SHAPE,
  NODE_BODY_PADDING,
  RESIZE_HANDLE_SIZE,
  getCollapsedNodeHeight,
  getNodeWidth,
  ELEMENT_TYPE,
  ATTR,
  CARET_SIZE,
  CARET_HIT_PADDING,
  CARET_NAME_GAP,
} from './constants'
import { getHandleRowHeight } from './handles/layout'
import { HandleView } from './HandleView'
import { EntityView } from './EntityView'
import { ResizeHandle } from './components/ResizeHandle'
import { CaretHandle } from './components/CaretHandle'

export class NodeView extends EntityView<Node> {
  _body: Konva.Rect
  _header: Konva.Rect
  _name: Konva.Text
  _resize: ResizeHandle
  /** Latest active-selection state, re-applied on fold changes (see `update`). */
  _isActive = false
  /** SubGraph marker tag rendered in the header, absent for normal nodes. */
  _tag?: Konva.Group
  /** Expand/collapse caret rendered in the header, absent for handle-less nodes. */
  _caret?: CaretHandle | null
  /**
   * Clipped container holding every handle view, so block content that
   * overflows its row (tall images, wrapping text) is cut at the node
   * boundary instead of painting over neighbors or forcing the node bigger.
   */
  _handleLayer: Konva.Group
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

    const hasCaret = node.handles.length > 0
    const caretArea = hasCaret ? CARET_AREA : 0

    const nameText = new Konva.Text({
      text: node.name,
      fontSize: 13,
      fill: COLORS.TEXT_PRIMARY,
      x: CARET_LEFT + caretArea,
      y: 7,
      width: width - 16 - caretArea,
      name: NODE_SHAPE.NAME,
    })
    g.add(nameText)

    const caret = hasCaret
      ? new CaretHandle(() => {
          node.setCollapsed(!node.collapsed)
        })
      : null
    if (caret) {
      caret.x(CARET_LEFT + CARET_HIT_PADDING)
      caret.y(LAYOUT.HEADER_HEIGHT / 2)
      caret.setCollapsed(node.collapsed)
      g.add(caret)
    }

    super(node, g)
    this._body = body
    this._header = header
    this._name = nameText
    this._caret = caret

    if (isSubGraphNode(node)) {
      const tag = createSubGraphTag()
      tag.x(width - SUBGRAPH_TAG_WIDTH - 8)
      tag.y(Math.round((LAYOUT.HEADER_HEIGHT - SUBGRAPH_TAG_HEIGHT) / 2))
      g.add(tag)
      this._tag = tag

      // Leave room on the right so the tag never overlaps the title.
      nameText.width(width - 16 - caretArea - SUBGRAPH_TAG_WIDTH - 4)
    }

    // Handles live in their own clipped container: block content is contained
    // to the node's size, so anything that overflows its row (tall images,
    // wrapping text) is cut at the node boundary. The clip is padded
    // horizontally by the joint radius so edge joints stay whole.
    const handleLayer = new Konva.Group({
      name: 'handleLayer',
      clipX: -LAYOUT.JOINT_RADIUS,
      clipY: 0,
      clipWidth: width + LAYOUT.JOINT_RADIUS * 2,
      clipHeight: height,
    })
    g.add(handleLayer)
    this._handleLayer = handleLayer
    // A node may be constructed already collapsed (e.g. restored from JSON):
    // hide the body and handle layer (and with them every joint) right away.
    body.visible(!node.collapsed)
    handleLayer.visible(!node.collapsed)

    this._syncHandles()

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

    // Reserve the caret's slot for foldable nodes and sync the fold state.
    const hasCaret = node.handles.length > 0
    const caretArea = hasCaret ? CARET_AREA : 0
    this._caret?.visible(hasCaret)
    this._caret?.setCollapsed(node.collapsed)
    this._name.x(CARET_LEFT + caretArea)

    if (this._tag) {
      // Leave room on the right so the tag never overlaps the title.
      this._name.width(width - 16 - caretArea - SUBGRAPH_TAG_WIDTH - 4)
      this._tag.x(width - SUBGRAPH_TAG_WIDTH - 8)
      this._tag.y(Math.round((LAYOUT.HEADER_HEIGHT - SUBGRAPH_TAG_HEIGHT) / 2))
    } else {
      this._name.width(width - 16 - caretArea)
    }

    this._syncHandles()
    // Collapsed nodes are the header band only: body and handle layer (every
    // joint included) hide, while handle views stay alive to re-show on expand.
    this._body.visible(!node.collapsed)
    this._handleLayer.visible(!node.collapsed)
    this._applyActiveStyles()

    const height = getNodeHeight(node)
    this._body.width(width)
    this._body.height(height)

    this._resize.x(width - RESIZE_HANDLE_SIZE)
    this._resize.y(height - RESIZE_HANDLE_SIZE)

    const clip = this._handleLayer
    clip.clipWidth(width + LAYOUT.JOINT_RADIUS * 2)
    clip.clipHeight(height)
  }

  /** Store the selection state; the chrome is applied by `_applyActiveStyles`. */
  setActive(isActive: boolean): void {
    this._isActive = isActive
    this._applyActiveStyles()
  }

  /**
   * Selection chrome depends on the fold state: a collapsed node has no body,
   * so the accent moves to the header band. Re-applied from `update()` too,
   * because collapsing/expanding changes which surface carries the accent.
   */
  _applyActiveStyles(): void {
    const isActive = this._isActive
    const collapsed = this.entity.collapsed
    // The accent rides the header while collapsed (no body), else the body.
    this._header.stroke(collapsed && isActive ? COLORS.ACCENT : '')
    this._header.strokeWidth(1)
    this._body.stroke(isActive ? COLORS.ACCENT : COLORS.BORDER)
    this._resize.visible(isActive && !collapsed)
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
        view = new HandleView(handle, () => this.update())
        this._handleViews.set(handle.key, view)
        this._handleLayer.add(view.group)
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
 * Effective node height. A manually sized node (`size.y > 0`) keeps exactly
 * its size — block content that doesn't fit is clipped by the node body
 * instead of expanding it. Auto-height nodes render at their content-driven
 * height, which is bounded because block rows never exceed their allocated
 * space.
 */
export function getNodeHeight(node: Node): number {
  if (node.collapsed) {
    return getCollapsedNodeHeight()
  }
  if (node.size.y > 0) {
    return node.size.y
  }
  return getNodeContentHeight(node)
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

/** Header left edge: caret + title start here. */
const CARET_LEFT = 8
/** Horizontal slot a caret occupies (chevron + hit padding + gap to title). */
const CARET_AREA = CARET_SIZE + CARET_HIT_PADDING * 2 + CARET_NAME_GAP

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
