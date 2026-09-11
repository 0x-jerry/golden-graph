import Konva from 'konva'
import type { Node, NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition, isSubGraphNode } from '@0x-jerry/golden-graph'
import {
  LAYOUT,
  NODE_SHAPE,
  NODE_BODY_PADDING,
  NODE_BODY_STROKE_WIDTH,
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
import { DEFAULT_THEME } from '../theme'
import type { GraphTheme, NodeCornerRadius } from '../theme'

/** A Konva.Group that may carry a theme re-application hook. */
type ThemedGroup = Konva.Group & { applyTheme?: (theme: GraphTheme) => void }

export class NodeView extends EntityView<Node> {
  _body: Konva.Rect
  /** Shadow caster behind the body; the body itself never casts one. */
  _shadow: Konva.Rect
  _header: Konva.Rect
  _headerDivider: Konva.Line
  /** Container for the pooled row separators. */
  _dividerLayer: Konva.Group
  _rowDividers: Konva.Line[] = []
  _name: Konva.Text
  _resize: ResizeHandle
  /** Latest selection state, re-applied on fold/theme changes. */
  _isActive = false
  /** Latest executor state, re-applied on theme changes. */
  _isProcessing = false
  _isCurrent = false
  /** SubGraph marker tag rendered in the header, absent for normal nodes. */
  _tag?: ThemedGroup
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
  /** Active theme, re-applied on hot-swap via `applyTheme`. */
  _theme: GraphTheme

  constructor(node: Node, theme: GraphTheme = DEFAULT_THEME) {
    const width = getNodeWidth(node)
    const height = getNodeHeight(node)

    const g = new Konva.Group({
      x: node.pos.x,
      y: node.pos.y,
      name: ELEMENT_TYPE.NODE,
      [ATTR.ELEMENT_ID]: node.id,
    })

    // A stroke-less rect behind the body carries the node's shadow: Konva
    // paints a shape's shadow once per fill/stroke pass, so a body that casts
    // its own shadow either doubles it along the stroke or needs the
    // "perfect draw" buffer canvas below to avoid it.
    const shadow = new Konva.Rect({
      width,
      height,
      fill: theme.colors.bg,
      cornerRadius: theme.metrics.nodeCornerRadius,
      listening: false,
      perfectDrawEnabled: false,
      name: NODE_SHAPE.SHADOW,
    })
    g.add(shadow)

    const body = new Konva.Rect({
      width,
      height,
      fill: theme.colors.bg,
      stroke: theme.colors.border,
      strokeWidth: 1,
      cornerRadius: theme.metrics.nodeCornerRadius,
      name: NODE_SHAPE.BODY,
    })
    g.add(body)

    // Decorations are always constructed (in paint order) and toggled by the
    // theme, so a style hot-swap never has to rebuild the view.
    const dividerLayer = new Konva.Group({ listening: false })

    const header = new Konva.Rect({
      width,
      height: LAYOUT.HEADER_HEIGHT,
      fill: theme.colors.headerBg,
      name: NODE_SHAPE.HEADER,
    })
    g.add(header)

    const headerDivider = new Konva.Line({
      strokeWidth: 1,
      visible: false,
      listening: false,
      name: NODE_SHAPE.HEADER_DIVIDER,
    })
    g.add(headerDivider)

    // Added above the header band so a style's spine also covers the band.
    const hasCaret = node.handles.length > 0
    const caretArea = hasCaret ? CARET_AREA : 0

    const nameText = new Konva.Text({
      text: node.name,
      fontSize: theme.fonts.size + 1,
      fontFamily: theme.fonts.family,
      fontStyle: TITLE_FONT_STYLE,
      fill: theme.colors.headerText,
      x: CARET_LEFT + caretArea,
      y: 7,
      width: width - 16 - caretArea,
      name: NODE_SHAPE.NAME,
    })
    g.add(nameText)

    const caret = hasCaret
      ? new CaretHandle(theme, () => {
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
    this._theme = theme
    this._body = body
    this._shadow = shadow
    this._dividerLayer = dividerLayer
    this._header = header
    this._headerDivider = headerDivider
    this._name = nameText
    this._caret = caret

    if (isSubGraphNode(node)) {
      const tag = createSubGraphTag(theme)
      g.add(tag)
      this._tag = tag
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
    // Row separators live inside the clip (under every row) so a node shorter
    // than its rows cuts them with the content instead of drawing past its own
    // silhouette, and collapsing hides them with the rows.
    handleLayer.add(dividerLayer)
    dividerLayer.moveToBottom()
    g.add(handleLayer)
    this._handleLayer = handleLayer
    shadow.visible(!node.collapsed)
    handleLayer.visible(!node.collapsed)

    this._syncHandles()

    const measuredHeight = getNodeHeight(node)
    this._body.height(measuredHeight)
    this._shadow.height(measuredHeight)

    const resize = new ResizeHandle(theme)
    g.add(resize)
    this._resize = resize

    this._layoutChrome()
    this._applyStyles()
  }

  update(): void {
    const node = this.entity
    const group = this.group

    group.x(node.pos.x)
    group.y(node.pos.y)

    const width = getNodeWidth(node)
    const height = getNodeHeight(node)

    this._body.width(width)
    this._body.height(height)
    this._shadow.width(width)
    this._shadow.height(height)

    this._syncHandles()
    this._shadow.visible(!node.collapsed)
    this._handleLayer.visible(!node.collapsed)

    this._layoutChrome()
    this._applyStyles()

    const clip = this._handleLayer
    clip.clipWidth(width + LAYOUT.JOINT_RADIUS * 2)
    clip.clipHeight(height)
  }

  /** Store the selection state; the chrome is applied by `_applyStyles`. */
  setActive(isActive: boolean): void {
    this._isActive = isActive
    this._applyStyles()
  }

  /** Highlight a node while the executor is running it. */
  setExecuteHighlight(isProcessing: boolean, isCurrent: boolean): void {
    this._isProcessing = isProcessing
    this._isCurrent = isCurrent
    this._applyStyles()
  }

  /**
   * Geometry of every style-driven decoration: node radius, header band,
   * title slot, separators and the resize grip. Derived from the entity + theme,
   * so it is re-runnable after either changes.
   */
  _layoutChrome(): void {
    const node = this.entity
    const theme = this._theme
    const { metrics, colors } = theme
    const width = getNodeWidth(node)
    const height = getNodeHeight(node)
    const collapsed = node.collapsed

    const bodyRadius = metrics.nodeCornerRadius
    this._body.cornerRadius(bodyRadius)
    this._shadow.cornerRadius(bodyRadius)

    // A collapsed node IS the header band, so insetting the band would leave
    // the node's own silhouette empty.
    const inset = collapsed ? 0 : metrics.headerInset
    const header = this._header
    header.x(inset + NODE_BODY_STROKE_WIDTH)
    header.y(inset + NODE_BODY_STROKE_WIDTH)
    header.width(Math.max(0, width - inset * 2) - NODE_BODY_STROKE_WIDTH * 2)
    header.height(
      Math.max(0, LAYOUT.HEADER_HEIGHT - inset * 2) -
        NODE_BODY_STROKE_WIDTH * 2,
    )
    // A full-bleed band inherits the body's top corners, otherwise a rounded
    // body shows the band's square corners through it. Collapsed, the band is
    // the whole silhouette, so it takes the body radius on all four corners.
    header.cornerRadius(
      collapsed
        ? bodyRadius
        : inset > 0
          ? metrics.headerCornerRadius
          : topCorners(bodyRadius),
    )

    const caretArea = node.handles.length > 0 ? CARET_AREA : 0
    const titleLeft = header.x() + CARET_LEFT + caretArea
    const titleRight =
      header.x() +
      header.width() -
      (this._tag ? SUBGRAPH_TAG_WIDTH + 4 : 0) -
      TITLE_PADDING

    const name = this._name
    name.text(node.name)
    name.fontFamily(theme.fonts.family)
    name.fontSize(theme.fonts.size + 1)
    name.x(titleLeft)
    name.width(Math.max(0, titleRight - titleLeft))
    name.y(Math.floor(header.y() + (header.height() - name.height()) / 2))

    if (this._caret) {
      this._caret.x(header.x() + CARET_LEFT + CARET_HIT_PADDING)
      this._caret.y(header.y() + header.height() / 2)
      this._caret.visible(node.handles.length > 0)
      this._caret.setCollapsed(collapsed)
    }

    if (this._tag) {
      this._tag.x(header.x() + header.width() - SUBGRAPH_TAG_WIDTH - 8)
      this._tag.y(
        Math.round(header.y() + (header.height() - SUBGRAPH_TAG_HEIGHT) / 2),
      )
    }

    const showHeaderDivider = !collapsed && colors.headerDivider !== ''
    this._headerDivider.visible(showHeaderDivider)
    if (showHeaderDivider) {
      const y = header.y() + header.height()
      this._headerDivider.points([
        header.x(),
        y,
        header.x() + header.width(),
        y,
      ])
    }

    this._syncRowDividers(bodyRadius)

    this._resize.x(width - RESIZE_HANDLE_SIZE)
    this._resize.y(height - RESIZE_HANDLE_SIZE)
  }

  /**
   * Pooled separators between handle rows. Positions come from the same row
   * layout the handle views use, so they track measured block content.
   */
  _syncRowDividers(bodyRadius: NodeCornerRadius): void {
    const node = this.entity
    const visible = !node.collapsed && this._theme.colors.rowDivider !== ''

    const order = node.handles
      .map((handle) => ({ handle, index: getHandleIndex(node, handle) }))
      .filter((entry) => entry.index >= 0)
      .sort((a, b) => a.index - b.index)

    const count = visible ? Math.max(0, order.length - 1) : 0
    while (this._rowDividers.length < count) {
      const line = new Konva.Line({
        strokeWidth: 1,
        name: NODE_SHAPE.ROW_DIVIDER,
      })
      this._rowDividers.push(line)
      this._dividerLayer.add(line)
    }

    const width = getNodeWidth(node)
    const inset = dividerInset(bodyRadius, width)
    let y = LAYOUT.HEADER_HEIGHT
    for (let i = 0; i < count; i++) {
      y += getHandleRowHeight(order[i]!.handle)
      this._rowDividers[i]!.points([inset, y, width - inset, y]).visible(true)
    }
    for (let i = count; i < this._rowDividers.length; i++) {
      this._rowDividers[i]!.visible(false)
    }
  }

  /** Paint the current theme + interaction state. Geometry lives in `_layoutChrome`. */
  _applyStyles(): void {
    const theme = this._theme
    const collapsed = this.entity.collapsed
    const active = this._isActive
    const running = this._isProcessing && this._isCurrent

    const styleShadow =
      theme.colors.nodeShadow !== 'transparent' &&
      (theme.metrics.nodeShadowBlur > 0 ||
        theme.metrics.nodeShadowOffsetX !== 0 ||
        theme.metrics.nodeShadowOffsetY !== 0)

    // The accent rides the body in both states: the header band is a fill-only
    // band, so the body outline stays visible (and accented) around it.
    this._body.fill(theme.colors.bg)
    this._body.stroke(active ? theme.colors.accent : theme.colors.border)
    this._body.strokeWidth(NODE_BODY_STROKE_WIDTH)
    this._body.shadowEnabled(false)

    // The shadow rect mirrors the body's fill and silhouette, so it stays
    // hidden behind an opaque body.
    this._shadow.fill(theme.colors.bg)
    // The executor's glow takes over from the style's static shadow while a
    // node runs, and restores it afterwards.
    if (running) {
      this._shadow.shadowColor(theme.colors.accentSoft)
      this._shadow.shadowBlur(theme.metrics.executorShadowBlur)
      this._shadow.shadowOffset({ x: 0, y: 0 })
    } else {
      this._shadow.shadowColor(theme.colors.nodeShadow)
      this._shadow.shadowBlur(theme.metrics.nodeShadowBlur)
      this._shadow.shadowOffset({
        x: theme.metrics.nodeShadowOffsetX,
        y: theme.metrics.nodeShadowOffsetY,
      })
    }
    this._shadow.shadowEnabled(running || styleShadow)

    this._header.fill(theme.colors.headerBg)

    this._headerDivider.stroke(theme.colors.headerDivider)
    for (const divider of this._rowDividers) {
      divider.stroke(theme.colors.rowDivider)
    }

    this._name.fill(theme.colors.headerText)

    this._resize.visible(active && !collapsed)
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
        view = new HandleView(handle, () => this.update(), this._theme)
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

  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    this._tag?.applyTheme?.(theme)
    this._caret?.applyTheme?.(theme)
    this._resize.applyTheme?.(theme)
    for (const view of this._handleViews.values()) view.applyTheme?.(theme)
    this._layoutChrome()
    this._applyStyles()
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

/**
 * Top corners the header band inherits from the body radius, in Konva's
 * positional `[top-left, top-right, bottom-right, bottom-left]` form.
 */
function topCorners(
  radius: NodeCornerRadius,
): [number, number, number, number] {
  if (Array.isArray(radius)) {
    return [radius[0] ?? 0, radius[1] ?? 0, 0, 0]
  }
  return [radius, radius, 0, 0]
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

/** Header left edge: caret + title start here. */
const CARET_LEFT = 8
/** Horizontal slot a caret occupies (chevron + hit padding + gap to title). */
const CARET_AREA = CARET_SIZE + CARET_HIT_PADDING * 2 + CARET_NAME_GAP
/** Gap between the title slot and the node's right edge. */
const TITLE_PADDING = 8
/** Node titles are always bold — not themeable. */
const TITLE_FONT_STYLE = 'bold'

const SUBGRAPH_TAG_TEXT = 'Composite'
const SUBGRAPH_TAG_WIDTH = 56
const SUBGRAPH_TAG_HEIGHT = 16

/** Marker tag drawn on the right of a SubGraphNode's header title. */
function createSubGraphTag(theme: GraphTheme): ThemedGroup {
  const tag = new Konva.Group({ name: NODE_SHAPE.TAG }) as ThemedGroup

  const bg = new Konva.Rect({
    width: SUBGRAPH_TAG_WIDTH,
    height: SUBGRAPH_TAG_HEIGHT,
    cornerRadius: 3,
    fill: theme.colors.subgraphTagBg,
  })

  const text = new Konva.Text({
    text: SUBGRAPH_TAG_TEXT,
    fontSize: theme.fonts.size - 2,
    fontFamily: theme.fonts.family,
    fill: theme.colors.subgraphTagText,
    width: SUBGRAPH_TAG_WIDTH,
    height: SUBGRAPH_TAG_HEIGHT,
    align: 'center',
    verticalAlign: 'middle',
  })

  tag.add(bg, text)

  tag.applyTheme = (t: GraphTheme) => {
    bg.fill(t.colors.subgraphTagBg)
    text.fill(t.colors.subgraphTagText)
    text.fontFamily(t.fonts.family)
    text.fontSize(t.fonts.size - 2)
  }

  return tag
}
