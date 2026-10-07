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
  it('scrolls long content and shows the overflow', () => {
    const module = makeModule('long text '.repeat(60))
    const area = module._scrollArea

    expect(area._contentHeight).toBeGreaterThan(area._h)
    area.fire('wheel', { evt: { preventDefault() {}, deltaY: 100 } }, true)
    expect(area.scrollTop).toBeGreaterThan(0)
    module.destroy()
  })

  it('does not scroll when the content fits', () => {
    const module = makeModule('x')
    const area = module._scrollArea

    expect(area._contentHeight).toBeLessThanOrEqual(area._h)
    area.fire('wheel', { evt: { preventDefault() {}, deltaY: 100 } }, true)
    expect(area.scrollTop).toBe(0)
    module.destroy()
  })
})
