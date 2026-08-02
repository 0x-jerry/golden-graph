import Konva from 'konva'
import type { Node, NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import {
  COLORS,
  LAYOUT,
  NODE_SHAPE,
  SEL,
  NODE_BODY_PADDING,
  RESIZE_HANDLE_SIZE,
  getNodeWidth,
  getNodeHeight,
  ELEMENT_TYPE,
  ATTR,
} from './constants'
import {
  renderHandle,
  updateHandle,
  destroyHandle,
  getHandleGroup,
} from './HandleRenderer'

export function computeNodeHeight(node: Node): number {
  const handleCount = node.handles.length || 1
  return (
    LAYOUT.HEADER_HEIGHT +
    handleCount * LAYOUT.HANDLE_ROW_HEIGHT +
    NODE_BODY_PADDING
  )
}

function renderResizeHandle(): Konva.Group {
  const size = RESIZE_HANDLE_SIZE
  const grip = new Konva.Group({
    name: NODE_SHAPE.RESIZE,
    // Shown only while the node is selected (see KonvaGraphRenderer._syncState).
    visible: false,
  })

  // Generous invisible hit area so the tiny triangle is easy to grab.
  const hit = new Konva.Rect({
    x: -10,
    y: -10,
    width: size + 20,
    height: size + 20,
    fill: 'transparent',
    cursor: 'nwse-resize',
    name: NODE_SHAPE.RESIZE,
  })
  grip.add(hit)

  const triangle = new Konva.Line({
    points: [0, size, size, size, size, 0],
    closed: true,
    fill: COLORS.ACCENT,
    stroke: COLORS.BG,
    strokeWidth: 1,
    listening: false,
  })
  grip.add(triangle)

  return grip
}

export function createNode(node: Node): Konva.Group {
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

  const handles = node.handles.filter((h) => h.position !== HandlePosition.None)
  const noneHandles = node.handles.filter(
    (h) => h.position === HandlePosition.None,
  )

  handles.forEach((handle, i) => {
    const hg = renderHandle(handle, i)
    g.add(hg)
  })

  noneHandles.forEach((handle, i) => {
    const hg = renderHandle(handle, handles.length + i)
    g.add(hg)
  })

  const resize = renderResizeHandle()
  resize.x(width - RESIZE_HANDLE_SIZE)
  resize.y(height - RESIZE_HANDLE_SIZE)
  g.add(resize)

  return g
}

export function updateNode(group: Konva.Group, node: Node): void {
  group.x(node.pos.x)
  group.y(node.pos.y)

  const nameText = group.findOne(SEL.NAME) as Konva.Text
  if (nameText) {
    nameText.text(node.name)
  }

  const width = getNodeWidth(node)
  const height = getNodeHeight(node)

  const body = group.findOne(SEL.BODY) as Konva.Rect
  if (body) {
    body.width(width)
    body.height(height)
  }

  const header = group.findOne(SEL.HEADER) as Konva.Rect
  if (header) {
    header.width(width)
  }

  if (nameText) {
    nameText.width(width - 16)
  }

  const resize = group.findOne(SEL.RESIZE) as Konva.Group | undefined
  if (resize) {
    resize.x(width - RESIZE_HANDLE_SIZE)
    resize.y(height - RESIZE_HANDLE_SIZE)
  }

  node.handles.forEach((handle) => {
    const hi = getHandleIndex(node, handle)
    if (hi < 0) return

    // Handles added after the node was created have no Konva group yet —
    // render them and insert into the node group so the new row shows up.
    if (!getHandleGroup(handle)) {
      group.add(renderHandle(handle, hi))
      return
    }

    updateHandle(handle, hi)
  })
}

export function destroyNode(group: Konva.Group, node: Node): void {
  node.handles.forEach((handle) => {
    destroyHandle(handle)
  })
  group.destroy()
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
