import { describe, it, expect } from 'vitest'
import {
  HandlePosition,
  Workspace,
} from '@0x-jerry/golden-graph'
import type { INodeSchema, NodeHandle } from '@0x-jerry/golden-graph'
import { displayHandleFactory } from '../../src/renderer/handles/DisplayHandle'
import type { ScrollArea } from '../../src/renderer/components/scroll'

function makeHandle(value: string): NodeHandle {
  const schema: INodeSchema = {
    type: 'Display',
    name: 'Display',
    handles: [
      {
        key: 'out',
        name: 'Out',
        type: 'display',
        position: HandlePosition.Right,
        value,
      },
    ],
  }
  const ws = new Workspace()
  ws.registerNodeSchema(schema)
  return ws.addNode('Display').getHandle('out')!
}

function makeModule(value: string) {
  const module = displayHandleFactory.create!(
    makeHandle(value),
    {},
    undefined,
  ) as unknown as { _scrollArea: ScrollArea; update(): void; destroy(): void }
  module.update()
  return module
}

describe('display handle scrolling', () => {
  it('scrolls long content but not when it fits', () => {
    const long = makeModule('long text '.repeat(60))
    const longArea = long._scrollArea
    expect(longArea._contentHeight).toBeGreaterThan(longArea._h)
    longArea.fire('wheel', { evt: { preventDefault() {}, deltaY: 100 } }, true)
    expect(longArea.scrollTop).toBeGreaterThan(0)
    long.destroy()

    const short = makeModule('x')
    const shortArea = short._scrollArea
    expect(shortArea._contentHeight).toBeLessThanOrEqual(shortArea._h)
    shortArea.fire('wheel', { evt: { preventDefault() {}, deltaY: 100 } }, true)
    expect(shortArea.scrollTop).toBe(0)
    short.destroy()
  })
})
