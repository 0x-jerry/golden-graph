import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Node, Workspace } from '@0x-jerry/golden-graph'
import { KonvaGraphRenderer } from '../../src/renderer/KonvaGraphRenderer'
import { getJointPos } from '../../src/renderer/EdgeView'
import { getHandleView } from '../../src/renderer/HandleView'
import { PROXIMITY_RADIUS } from '../../src/renderer/constants'
import { createWorkspace } from '../helpers/workspace'

interface Setup {
  ws: Workspace
  renderer: KonvaGraphRenderer
  connect: KonvaGraphRenderer['_interaction']['_connect']
  src: Node
  target: Node
  srcJoint: { x: number; y: number }
  targetJoint: { x: number; y: number }
  onPointerAt: (pos: { x: number; y: number }) => void
}

function createRenderer(proximityRadius?: number): Setup {
  const ws = createWorkspace()

  const src = ws.addNode('Number')
  src.moveTo(0, 0)
  const target = ws.addNode('Sum')
  target.moveTo(300, 0)

  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'clientHeight', { value: 600 })

  const renderer = new KonvaGraphRenderer(container, ws, { proximityRadius })
  renderers.push(renderer)
  const connect = renderer._interaction._connect

  const srcHandle = src.getHandle('value')!
  const targetHandle = target.getHandle('a')!
  const srcJoint = getJointPos(srcHandle)
  const targetJoint = getJointPos(targetHandle)

  const onPointerAt = (pos: { x: number; y: number }) => {
    vi.spyOn(renderer.stage, 'getPointerPosition').mockReturnValue(pos)
  }

  return {
    ws,
    renderer,
    connect,
    src,
    target,
    srcJoint,
    targetJoint,
    onPointerAt,
  }
}

const renderers: KonvaGraphRenderer[] = []

afterEach(() => {
  for (const r of renderers.splice(0)) {
    r.dispose()
  }
  vi.restoreAllMocks()
})

describe('ConnectGesture proximity connect', () => {
  it('snaps the preview line to a compatible joint within the radius', () => {
    const { connect, src, srcJoint, targetJoint, onPointerAt } =
      createRenderer()

    onPointerAt(srcJoint)
    connect.start('value', src.id)

    // Near (but not on) the target joint — 6px away, outside the 5px joint.
    connect.move({ x: targetJoint.x + 6, y: targetJoint.y })

    expect(connect._connectTargetHandle).not.toBeNull()
    // Endpoint snaps to the joint position, not the raw pointer.
    const points = connect._connectionLine.points()
    expect(points[6]).toBe(targetJoint.x)
    expect(points[7]).toBe(targetJoint.y)
  })

  it('connects on release while the pointer stays within the radius', () => {
    const { ws, connect, src, target, srcJoint, targetJoint, onPointerAt } =
      createRenderer()

    onPointerAt(srcJoint)
    connect.start('value', src.id)
    connect.move({ x: targetJoint.x + 6, y: targetJoint.y })

    onPointerAt({ x: targetJoint.x + 6, y: targetJoint.y })
    connect.end()

    const srcHandle = src.getHandle('value')!
    expect(ws.queryEdges(srcHandle.loc)).toHaveLength(1)
    expect(srcHandle.connectedHandle).toBe(target.getHandle('a')!)
  })

  it('does not target or connect when the pointer is beyond the radius', () => {
    const { ws, connect, src, srcJoint, onPointerAt } = createRenderer()

    onPointerAt(srcJoint)
    connect.start('value', src.id)
    connect.move({ x: srcJoint.x, y: srcJoint.y + 200 })

    expect(connect._connectTargetHandle).toBeNull()

    onPointerAt({ x: srcJoint.x, y: srcJoint.y + 200 })
    connect.end()

    expect(ws.queryEdges(src.getHandle('value')!.loc)).toHaveLength(0)
  })

  it('disables proximity when the radius is 0', () => {
    const { ws, connect, src, targetJoint, onPointerAt } = createRenderer(0)

    onPointerAt({ x: 200, y: 44 })
    connect.start('value', src.id)
    connect.move({ x: targetJoint.x + 6, y: targetJoint.y })

    expect(connect._connectTargetHandle).toBeNull()

    onPointerAt({ x: targetJoint.x + 6, y: targetJoint.y })
    connect.end()

    expect(ws.queryEdges(src.getHandle('value')!.loc)).toHaveLength(0)
  })

  it('never targets a joint on the source node itself', () => {
    const { connect, src, srcJoint, onPointerAt } = createRenderer()

    onPointerAt(srcJoint)
    connect.start('value', src.id)

    // Near the source node's own row area — only its own joints exist nearby.
    connect.move({ x: 5, y: srcJoint.y })

    expect(connect._connectTargetHandle).toBeNull()
  })

  it('connects on an exact compatible joint hit', () => {
    const {
      ws,
      renderer,
      connect,
      src,
      srcJoint,
      target,
      targetJoint,
      onPointerAt,
    } = createRenderer()

    const targetHandle = target.getHandle('a')!
    // Simulate the pointer landing exactly on the joint — the shape returned
    // by `getIntersection` is the target's joint circle.
    vi.spyOn(renderer.stage, 'getIntersection').mockReturnValue(
      getHandleView(targetHandle)!._joint!,
    )

    onPointerAt(srcJoint)
    connect.start('value', src.id)
    connect.move(targetJoint)

    expect(connect._connectTargetHandle).toBe(targetHandle)

    onPointerAt(targetJoint)
    connect.end()

    expect(ws.queryEdges(src.getHandle('value')!.loc)).toHaveLength(1)
  })

  it('blocks proximity fallback when landing exactly on an incompatible joint', () => {
    const ws = createWorkspace()

    const src = ws.addNode('Sum')
    src.moveTo(0, 0)
    const sum2 = ws.addNode('Sum')
    sum2.moveTo(300, 0)
    const num3 = ws.addNode('Number')
    num3.moveTo(80, 40)

    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })

    const renderer = new KonvaGraphRenderer(container, ws)
    renderers.push(renderer)
    const connect = renderer._interaction._connect

    const srcHandle = src.getHandle('a')!
    const srcJoint = getJointPos(srcHandle)
    // Left-to-Left with the source → incompatible, so exact-hitting it must
    // block the proximity fallback rather than snap to a nearby compatible
    // joint the user wasn't aiming at.
    const incompatibleHandle = sum2.getHandle('b')!
    const incompatibleJoint = getJointPos(incompatibleHandle)
    const compatibleHandle = num3.getHandle('value')!
    const compatibleJoint = getJointPos(compatibleHandle)

    // Precondition: a compatible joint sits within the radius of the
    // incompatible joint's position, so the fallback would otherwise fire.
    const dist = Math.hypot(
      compatibleJoint.x - incompatibleJoint.x,
      compatibleJoint.y - incompatibleJoint.y,
    )
    expect(dist).toBeLessThan(PROXIMITY_RADIUS)

    vi.spyOn(renderer.stage, 'getPointerPosition').mockReturnValue(srcJoint)
    connect.start('a', src.id)

    vi.spyOn(renderer.stage, 'getIntersection').mockReturnValue(
      getHandleView(incompatibleHandle)!._joint!,
    )
    connect.move(incompatibleJoint)

    expect(connect._connectTargetHandle).toBeNull()

    connect.end()
    expect(ws.queryEdges(srcHandle.loc)).toHaveLength(0)
  })
})
