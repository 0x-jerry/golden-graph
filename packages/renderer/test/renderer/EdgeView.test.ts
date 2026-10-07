import { describe, it, expect } from 'vitest'
import type Konva from 'konva'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle, makeEdge } from '../helpers/entities'
import { find } from '../helpers/konva'
import { EdgeView } from '../../src/renderer/EdgeView'
import { LAYOUT } from '../../src/renderer/constants'

describe('EdgeView', () => {
  it('builds a bezier, tracks node moves, and docks a collapsed endpoint at the header', () => {
    const a = makeNode(1, 'A', { x: 0, y: 0 })
    addHandle(a, 'out', { position: HandlePosition.Right })
    const b = makeNode(2, 'B', { x: 300, y: 0 })
    addHandle(b, 'in', { position: HandlePosition.Left })

    const edge = makeEdge({ node: a, key: 'out' }, { node: b, key: 'in' })
    if (!edge) throw new Error('edge is null')

    const view = new EdgeView(edge)
    const line = find<Konva.Line>(view.group, '.edge-line')
    expect(line.points().length).toBe(8)

    const before = [...line.points()]
    b.moveTo(500, 100)
    view.update()
    expect([...line.points()]).not.toEqual(before)

    // Collapsed: `b` docks at its left edge on the header center.
    b.moveTo(300, 100)
    b.setCollapsed(true)
    view.update()
    const dockedY = b.pos.y + LAYOUT.HEADER_HEIGHT / 2
    const points = line.points()
    expect(points[0]).toBe(b.pos.x)
    expect(points[1]).toBe(dockedY)

    // Expanding restores the real (header + first row center) joint.
    b.setCollapsed(false)
    view.update()
    const restored = line.points()
    const jointY =
      b.pos.y + LAYOUT.HEADER_HEIGHT + LAYOUT.HANDLE_ROW_HEIGHT / 2
    expect(restored[1]).toBe(jointY)
    expect(restored[0]).toBe(b.pos.x)
  })
})
