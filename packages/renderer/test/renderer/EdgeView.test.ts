import { describe, it, expect } from 'vitest'
import type Konva from 'konva'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle, makeEdge } from '../helpers/entities'
import { find } from '../helpers/konva'
import { EdgeView } from '../../src/renderer/EdgeView'

describe('EdgeView', () => {
  it('builds a bezier line and updates geometry on node move', () => {
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

    const after = [...line.points()]
    expect(after).not.toEqual(before)
  })
})
