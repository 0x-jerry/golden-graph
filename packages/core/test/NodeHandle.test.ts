import { describe, it, expect } from 'vitest'
import { HandlePosition, Node, NodeHandle, NodeHandleType } from '../src'

class TestNode extends Node {
  static nodeName = 'Test'

  constructor() {
    super()
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
      description: 'Feed a number here',
      accepts: ['number'],
      position: HandlePosition.Left,
      type: 'number',
      options: { min: 0 },
    })
    expect(handle.key).toBe('input')
    expect(handle.name).toBe('Input')
    expect(handle.description).toBe('Feed a number here')
    expect(handle.accepts).toEqual(['number'])
    expect(handle.isLeft).toBe(true)
    expect(handle.type).toBe('number')
  })

  it('defaults description to empty string when absent', () => {
    const node = new TestNode()
    const handle = new NodeHandle()
    handle.setNode(node)
    handle.fromConfig({
      key: 'out',
      name: 'Output',
      position: HandlePosition.Right,
      accepts: ['number'],
    })
    expect(handle.description).toBe('')
  })

  it('canConnectTo respects position and type', () => {
    const a = new TestNode()
    const b = new TestNode()
    const h1 = new NodeHandle()
    const h2 = new NodeHandle()
    h1.setNode(a)
    h2.setNode(b)
    h1.fromConfig({
      key: 'out',
      position: HandlePosition.Right,
      accepts: ['number'],
    })
    h2.fromConfig({
      key: 'in',
      position: HandlePosition.Left,
      accepts: ['number'],
    })
    expect(h1.canConnectTo(h2)).toBe(true)

    h2.fromConfig({
      key: 'in',
      position: HandlePosition.Left,
      accepts: ['string'],
    })
    expect(h1.canConnectTo(h2)).toBe(false)

    h1.fromConfig({
      key: 'out',
      position: HandlePosition.Right,
      accepts: [NodeHandleType.All],
    })
    expect(h1.canConnectTo(h2)).toBe(true)
  })
})
