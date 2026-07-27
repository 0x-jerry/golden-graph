import { describe, it, expect } from 'vitest'
import { HandlePosition, Node } from '../../src/core'

class TNode extends Node {
  constructor() {
    super()
    this._type = 'TNode'
  }
}

describe('Node', () => {
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
})

