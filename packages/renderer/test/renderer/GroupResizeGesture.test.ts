import { describe, expect, it } from 'vitest'
import type Konva from 'konva'
import { ActiveType } from '@0x-jerry/golden-graph'
import { createWorkspace, makeGroup } from '../helpers/workspace'
import {
  GroupResizeGesture,
} from '../../src/renderer/interaction/GroupResizeGesture'
import type { GestureContext } from '../../src/renderer/interaction/types'
import { GROUP_MIN_HEIGHT, GROUP_MIN_WIDTH } from '../../src/renderer/constants'

function makeGesture() {
  const ws = createWorkspace()
  const stage = {
    getPointerPosition: () => ({ x: 0, y: 0 }),
  } as unknown as Konva.Stage
  const gesture = new GroupResizeGesture({
    stage,
    ws,
    renderOverlay: () => {},
  } as GestureContext)
  return { ws, gesture }
}

function addGroup(
  ws: ReturnType<typeof createWorkspace>,
  pos: { x: number; y: number },
  size: { x: number; y: number },
) {
  return makeGroup(ws, { pos, size })
}

describe('GroupResizeGesture', () => {
  it('pins the bottom-right corner to the pointer', () => {
    const { ws, gesture } = makeGesture()
    const group = addGroup(ws, { x: 10, y: 20 }, { x: 300, y: 200 })

    gesture.start(group.id)
    gesture.move({ x: 250, y: 300 })

    expect(group.size).toEqual({ x: 240, y: 280 })
  })

  it('clamps width/height to their minimums', () => {
    const { ws, gesture } = makeGesture()
    const group = addGroup(ws, { x: 0, y: 0 }, { x: 300, y: 200 })

    gesture.start(group.id)
    gesture.move({ x: -300, y: -300 })

    expect(group.size.x).toBe(GROUP_MIN_WIDTH)
    expect(group.size.y).toBe(GROUP_MIN_HEIGHT)
  })

  it('resyncs the corner to the pointer after a clamp', () => {
    const { ws, gesture } = makeGesture()
    const group = addGroup(ws, { x: 10, y: 20 }, { x: 300, y: 200 })

    gesture.start(group.id)
    gesture.move({ x: -200, y: -200 })
    expect(group.size.x).toBe(GROUP_MIN_WIDTH)

    // The clamped overshoot must not shift the corner off the pointer.
    gesture.move({ x: 260, y: 300 })
    expect(group.size).toEqual({ x: 250, y: 280 })
  })

  it('selects the group it resizes', () => {
    const { ws, gesture } = makeGesture()
    const group = addGroup(ws, { x: 0, y: 0 }, { x: 300, y: 200 })

    gesture.start(group.id)

    expect(ws.state.activeType).toBe(ActiveType.Group)
    expect(ws.isActive(group.id)).toBe(true)
  })
})
