import { describe, it, expect } from 'vitest'
import { HandlePosition, Node, NodeType } from '../../src/core'

class TNode extends Node {
  constructor() {
    super()
    this._type = 'TNode'
  }
}

describe('Node', () => {
  it('updateByOption sets name, pos, description and data', () => {
    const n = new TNode()
    n.updateByOption({
      name: 'A',
      description: 'desc',
      pos: { x: 10, y: 20 },
      data: { a: 1 },
    })
    expect(n.name).toBe('A')
    expect(n.description).toBe('desc')
    expect(n.pos).toEqual({ x: 10, y: 20 })
    expect(n.getData('a')).toBe(1)
  })

  it('addHandle and get/query handles', () => {
    const n = new TNode()
    n.addHandle({ key: 'input', type: 'number', position: HandlePosition.Left })
    n.addHandle({ key: 'output', type: 'number', position: HandlePosition.Right, value: 5 })
    expect(n.getHandle('input')!.isLeft).toBe(true)
    expect(n.queryHandles(HandlePosition.Right)).toHaveLength(1)
    expect(n.getData('output')).toBe(5)
  })

  it('move and moveTo', () => {
    const n = new TNode()
    n.move(3, 4)
    expect(n.pos).toEqual({ x: 3, y: 4 })
    n.moveTo(1, 2)
    expect(n.pos).toEqual({ x: 1, y: 2 })
  })

  it('toJSON/fromJSON', () => {
    const n = new TNode()
    n.id = 7
    n.moveTo(3, 4)
    n.setData('k', 'v')
    const json = n.toJSON()
    const m = new TNode()
    m.fromJSON(json)
    expect(m.id).toBe(7)
    expect(m.pos).toEqual({ x: 3, y: 4 })
    expect(m.getData('k')).toBe('v')
  })
})

