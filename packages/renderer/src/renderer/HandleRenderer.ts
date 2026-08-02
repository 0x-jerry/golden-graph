import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import {
  COLORS,
  LAYOUT,
  NODE_SHAPE,
  SEL,
  HANDLE_CONTENT_X,
  HANDLE_CONTENT_Y_OFFSET,
  HANDLE_NAME_WIDTH,
  HANDLE_NAME_GAP,
  ELEMENT_TYPE,
  ATTR,
  getNodeWidth,
} from './constants'
import { getHandleModule } from './handles'

const handleGroupMap = new WeakMap<NodeHandle, Konva.Group>()
const handleModuleMap = new WeakMap<NodeHandle, string>()

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

function layoutContent(
  handle: NodeHandle,
  content: Konva.Group,
  label: Konva.Text,
): void {
  const nameWidth = label.width()
  content.x(contentX(handle, nameWidth))
  if (handle.position === HandlePosition.Right) {
    content.offsetX(content.getClientRect().width)
  } else {
    content.offsetX(0)
  }
}

export function renderHandle(handle: NodeHandle, index: number): Konva.Group {
  const group = new Konva.Group({
    name: ELEMENT_TYPE.HANDLE,
    [ATTR.ELEMENT_ID]: handle.key,
  })
  handleGroupMap.set(handle, group)

  if (
    handle.position === HandlePosition.Left ||
    handle.position === HandlePosition.Right
  ) {
    const circle = new Konva.Circle({
      x: handle.position === HandlePosition.Left ? 0 : getNodeWidth(handle.node),
      y: handleY(index),
      radius: LAYOUT.JOINT_RADIUS,
      fill: COLORS.JOINT_DEFAULT,
      stroke: COLORS.BORDER,
      strokeWidth: 1,
      name: ELEMENT_TYPE.JOINT,
    })
    group.add(circle)
  }

  const moduleType = handle.getOptions().type
  handleModuleMap.set(handle, moduleType)

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

  const hModule = getHandleModule(moduleType)
  if (hModule) {
    const contentGroup = hModule.create(handle, handle.getOptions())
    contentGroup.name(NODE_SHAPE.CONTENT)
    contentGroup.y(handleY(index) - HANDLE_CONTENT_Y_OFFSET)

    layoutContent(handle, contentGroup, label)

    group.add(contentGroup)
  }

  return group
}

export function updateHandle(handle: NodeHandle, index: number): void {
  const group = handleGroupMap.get(handle)
  if (!group) return

  const joint = group.findOne('.joint') as Konva.Circle
  if (joint) {
    joint.y(handleY(index))
    joint.x(handle.position === HandlePosition.Left ? 0 : getNodeWidth(handle.node))
    if (handle.isConnected) {
      joint.fill(COLORS.ACCENT)
    } else {
      joint.fill(COLORS.JOINT_DEFAULT)
    }
  }

  const label = group.findOne('.label') as Konva.Text
  if (label) {
    label.y(handleY(index))
    label.x(labelX(handle))
  }

  const hModule = getHandleModule(handleModuleMap.get(handle) || '')
  if (hModule?.update) {
    const content = group.findOne(SEL.CONTENT) as Konva.Group
    if (content) {
      hModule.update(content, handle)
      // Re-layout after the module may have changed its own size
      // (e.g. width follows the node width).
      layoutContent(handle, content, label)
    }
  }
}

export function destroyHandle(handle: NodeHandle): void {
  handleGroupMap.delete(handle)
  handleModuleMap.delete(handle)
}

export function getHandleGroup(handle: NodeHandle): Konva.Group | undefined {
  return handleGroupMap.get(handle)
}
