import { describe, it, expect } from 'vitest'
import { HandlePosition, Node, NodeHandle, NodeHandleType } from '../../src/core'

class TestNode extends Node {
  constructor() {
    super()
    this.name = 'Test'
  }
}

describe('NodeHandle', () => {
  it('fromConfig and properties', () => {
    const node = new TestNode()
    const handle = new NodeHandle()
    handle.setNode(node)
    handle.fromConfig({
      key: 'input',
      name: 'Input',
      type: ['number'],
      position: HandlePosition.Left,
      options: { type: 'number', min: 0 },
    })
    expect(handle.key).toBe('input')
    expect(handle.name).toBe('Input')
    expect(handle.type).toEqual(['number'])
    expect(handle.isLeft).toBe(true)
    expect(handle.getOptions().type).toBe('number')
  })

  it('canConnectTo respects position and type', () => {
    const a = new TestNode()
    const b = new TestNode()
    const h1 = new NodeHandle()
    const h2 = new NodeHandle()
    h1.setNode(a)
    h2.setNode(b)
    h1.fromConfig({ key: 'out', position: HandlePosition.Right, type: ['number'] })
    h2.fromConfig({ key: 'in', position: HandlePosition.Left, type: ['number'] })
    expect(h1.canConnectTo(h2)).toBe(true)

    h2.fromConfig({ key: 'in', position: HandlePosition.Left, type: ['string'] })
    expect(h1.canConnectTo(h2)).toBe(false)

    h1.fromConfig({ key: 'out', position: HandlePosition.Right, type: [NodeHandleType.All] })
    expect(h1.canConnectTo(h2)).toBe(true)
  })
})

