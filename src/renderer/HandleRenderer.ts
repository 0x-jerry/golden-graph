import Konva from 'konva'
import type { NodeHandle } from '../core'
import { HandlePosition } from '../core'
import { COLORS, LAYOUT } from './types'
import { getHandleModule } from './handles'

const handleGroupMap = new WeakMap<NodeHandle, Konva.Group>()
const handleModuleMap = new WeakMap<NodeHandle, string>()

function handleY(index: number): number {
  return LAYOUT.HEADER_HEIGHT + index * LAYOUT.HANDLE_ROW_HEIGHT + LAYOUT.HANDLE_ROW_HEIGHT / 2
}

export function renderHandle(handle: NodeHandle, index: number): Konva.Group {
  const group = new Konva.Group({
    name: `handle-${handle.key}`,
  })
  handleGroupMap.set(handle, group)

  const jointName = `joint-${handle.node.id}-${handle.key}`

  if (handle.position === HandlePosition.Left) {
    const circle = new Konva.Circle({
      x: 0,
      y: handleY(index),
      radius: LAYOUT.JOINT_RADIUS,
      fill: COLORS.JOINT_DEFAULT,
      stroke: COLORS.BORDER,
      strokeWidth: 1,
      name: jointName,
    })
    group.add(circle)
  } else if (handle.position === HandlePosition.Right) {
    const circle = new Konva.Circle({
      x: LAYOUT.NODE_WIDTH,
      y: handleY(index),
      radius: LAYOUT.JOINT_RADIUS,
      fill: COLORS.JOINT_DEFAULT,
      stroke: COLORS.BORDER,
      strokeWidth: 1,
      name: jointName,
    })
    group.add(circle)
  }

  const moduleType = handle.getOptions().type
  handleModuleMap.set(handle, moduleType)

  const hModule = getHandleModule(moduleType)
  if (hModule) {
    const contentGroup = hModule.create(handle, handle.getOptions())
    contentGroup.name('content')

    if (handle.position === HandlePosition.Left) {
      contentGroup.x(LAYOUT.JOINT_RADIUS + 4)
      contentGroup.y(handleY(index) - 8)
    } else if (handle.position === HandlePosition.Right) {
      contentGroup.x(LAYOUT.NODE_WIDTH - LAYOUT.JOINT_RADIUS - 4)
      contentGroup.y(handleY(index) - 8)
      contentGroup.offsetX(contentGroup.getClientRect().width)
    }

    group.add(contentGroup)
  }

  return group
}

export function updateHandle(handle: NodeHandle, index: number): void {
  const group = handleGroupMap.get(handle)
  if (!group) return

  const hModule = getHandleModule(handleModuleMap.get(handle) || '')
  if (hModule?.update) {
    const content = group.findOne('.content') as Konva.Group
    if (content) {
      hModule.update(content, handle)
    }
  }

  const joint = group.findOne('.joint') as Konva.Circle
  if (joint) {
    joint.y(handleY(index))
    if (handle.isConnected) {
      joint.fill(COLORS.ACCENT)
    } else {
      joint.fill(COLORS.JOINT_DEFAULT)
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
