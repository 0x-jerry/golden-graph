import { describe, it, expect } from 'vitest'
import { HandlePosition, Node } from '../src'

class TNode extends Node {
  constructor() {
    super()
    this._type = 'TNode'
  }
}

describe('Node', () => {
  it('addHandle and get/query handles', () => {
    const n = new TNode()
    n.addHandle({
      key: 'input',
      accepts: 'number',
      position: HandlePosition.Left,
    })
    n.addHandle({
      key: 'output',
      accepts: 'number',
      position: HandlePosition.Right,
      value: 5,
    })
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

  it('size defaults to auto, omits auto from JSON and tolerates missing size on load', () => {
    const n = new TNode()
    expect(n.size).toEqual({ x: 0, y: 0 })
    expect(n.toJSON().size).toBeUndefined()

    const loaded = new TNode()
    loaded.fromJSON({ id: 1, type: 'TNode', pos: { x: 1, y: 2 } })
    expect(loaded.size).toEqual({ x: 0, y: 0 })
  })

  it('setSize and JSON round-trip', () => {
    const n = new TNode()
    n.setSize({ x: 320, y: 140 })

    expect(n.size).toEqual({ x: 320, y: 140 })

    const json = n.toJSON()
    expect(json.size).toEqual({ x: 320, y: 140 })

    const restored = new TNode()
    restored.fromJSON(json)
    expect(restored.size).toEqual({ x: 320, y: 140 })
  })

  it('collapsed defaults to false, omits false from JSON and tolerates missing on load', () => {
    const n = new TNode()
    expect(n.collapsed).toBe(false)
    expect(n.toJSON().collapsed).toBeUndefined()

    const loaded = new TNode()
    loaded.fromJSON({ id: 1, type: 'TNode', pos: { x: 1, y: 2 } })
    expect(loaded.collapsed).toBe(false)
  })

  it('setCollapsed toggles the flag and JSON round-trips it', () => {
    const n = new TNode()
    n.setCollapsed(true)

    expect(n.collapsed).toBe(true)
    expect(n.toJSON().collapsed).toBe(true)

    const restored = new TNode()
    restored.fromJSON(n.toJSON())
    expect(restored.collapsed).toBe(true)
  })
})
