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
  it('snaps, connects on release, and honours an exact joint hit', () => {
    const a = createRenderer()
    a.onPointerAt(a.srcJoint)
    a.connect.start('value', a.src.id)

    // Near (but not on) the target joint — 6px away, outside the 5px joint.
    a.connect.move({ x: a.targetJoint.x + 6, y: a.targetJoint.y })
    expect(a.connect._connectTargetHandle).not.toBeNull()
    // Endpoint snaps to the joint position, not the raw pointer.
    const points = a.connect._connectionLine.points()
    expect(points[6]).toBe(a.targetJoint.x)
    expect(points[7]).toBe(a.targetJoint.y)

    a.onPointerAt({ x: a.targetJoint.x + 6, y: a.targetJoint.y })
    a.connect.end()
    const srcHandleA = a.src.getHandle('value')!
    expect(a.ws.queryEdges(srcHandleA.loc)).toHaveLength(1)
    expect(srcHandleA.connectedHandle).toBe(a.target.getHandle('a')!)

    // Pointer landing exactly on the joint uses the hit shape directly.
    const b = createRenderer()
    const targetHandle = b.target.getHandle('a')!
    vi.spyOn(b.renderer.stage, 'getIntersection').mockReturnValue(
      getHandleView(targetHandle)!._joint!,
    )
    b.onPointerAt(b.srcJoint)
    b.connect.start('value', b.src.id)
    b.connect.move(b.targetJoint)
    expect(b.connect._connectTargetHandle).toBe(targetHandle)
    b.onPointerAt(b.targetJoint)
    b.connect.end()
    expect(b.ws.queryEdges(b.src.getHandle('value')!.loc)).toHaveLength(1)
  })

  it('does not target beyond the radius or when the radius is 0', () => {
    const a = createRenderer()
    a.onPointerAt(a.srcJoint)
    a.connect.start('value', a.src.id)
    a.connect.move({ x: a.srcJoint.x, y: a.srcJoint.y + 200 })
    expect(a.connect._connectTargetHandle).toBeNull()
    a.onPointerAt({ x: a.srcJoint.x, y: a.srcJoint.y + 200 })
    a.connect.end()
    expect(a.ws.queryEdges(a.src.getHandle('value')!.loc)).toHaveLength(0)

    const b = createRenderer(0)
    b.onPointerAt({ x: 200, y: 44 })
    b.connect.start('value', b.src.id)
    b.connect.move({ x: b.targetJoint.x + 6, y: b.targetJoint.y })
    expect(b.connect._connectTargetHandle).toBeNull()
    b.onPointerAt({ x: b.targetJoint.x + 6, y: b.targetJoint.y })
    b.connect.end()
    expect(b.ws.queryEdges(b.src.getHandle('value')!.loc)).toHaveLength(0)
  })

  it('never targets a joint on the source node itself', () => {
    const { connect, src, srcJoint, onPointerAt } = createRenderer()

    onPointerAt(srcJoint)
    connect.start('value', src.id)

    // Near the source node's own row area — only its own joints exist nearby.
    connect.move({ x: 5, y: srcJoint.y })

    expect(connect._connectTargetHandle).toBeNull()
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
