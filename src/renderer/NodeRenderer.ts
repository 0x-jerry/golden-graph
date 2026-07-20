import Konva from 'konva'
import type { Node, NodeHandle } from '../core'
import { HandlePosition } from '../core'
import {
  COLORS,
  LAYOUT,
  NODE_SHAPE,
  SEL,
  NODE_BODY_PADDING,
  ELEMENT_TYPE,
  ATTR,
} from './constants'
import { renderHandle, updateHandle, destroyHandle } from './HandleRenderer'

export function computeNodeHeight(node: Node): number {
  const handleCount = node.handles.length || 1
  return (
    LAYOUT.HEADER_HEIGHT +
    handleCount * LAYOUT.HANDLE_ROW_HEIGHT +
    NODE_BODY_PADDING
  )
}

export function createNode(node: Node): Konva.Group {
  const height = computeNodeHeight(node)
  const g = new Konva.Group({
    x: node.pos.x,
    y: node.pos.y,
    name: ELEMENT_TYPE.NODE,
    [ATTR.ELEMENT_ID]: node.id,
  })

  const body = new Konva.Rect({
    width: LAYOUT.NODE_WIDTH,
    height,
    fill: COLORS.BG,
    stroke: COLORS.BORDER,
    strokeWidth: 1,
    name: NODE_SHAPE.BODY,
  })
  g.add(body)

  const header = new Konva.Rect({
    width: LAYOUT.NODE_WIDTH,
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
    width: LAYOUT.NODE_WIDTH - 16,
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

  return g
}

export function updateNode(group: Konva.Group, node: Node): void {
  group.x(node.pos.x)
  group.y(node.pos.y)

  const nameText = group.findOne(SEL.NAME) as Konva.Text
  if (nameText) {
    nameText.text(node.name)
  }

  const height = computeNodeHeight(node)
  const body = group.findOne(SEL.BODY) as Konva.Rect
  if (body) {
    body.height(height)
  }

  node.handles.forEach((handle) => {
    const hi = getHandleIndex(node, handle)
    if (hi < 0) return
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
