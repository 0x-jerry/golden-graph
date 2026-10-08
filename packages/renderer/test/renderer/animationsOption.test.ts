import { describe, it, expect } from 'vitest'
import { HandlePosition, Workspace } from '@0x-jerry/golden-graph'
import type { INodeSchema, NodeHandle } from '@0x-jerry/golden-graph'
import { createWorkspace } from '../helpers/workspace'
import { KonvaGraphRenderer } from '../../src/renderer'
import { displayHandleFactory } from '../../src/renderer/handles/DisplayHandle'
import type { ScrollArea } from '../../src/renderer/components/scroll'

function makeContainer() {
  const c = document.createElement('div')
  Object.defineProperty(c, 'clientWidth', { value: 800 })
  Object.defineProperty(c, 'clientHeight', { value: 600 })
  return c
}

/** Workspace with one scrollable `display` node. */
function createDisplayWorkspace() {
  const ws = createWorkspace()
  const schema: INodeSchema = {
    type: 'Display',
    name: 'Display',
    handles: [
      {
        key: 'out',
        name: 'Out',
        type: 'display',
        position: HandlePosition.Right,
        value: 'long text '.repeat(60),
      },
    ],
  }
  ws.registerNodeSchema(schema)
  return ws
}

function makeDisplayHandle(value: string): NodeHandle {
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

/** Scrollbar of a `display` handle's widget, reached through the view. */
function scrollbarOf(view: unknown) {
  const module = (
    view as { _module: { _scrollArea: ScrollArea } | null }
  )._module!
  return module._scrollArea._scrollbar
}

describe('renderer animations option', () => {
  it('defaults to enabled and reports what it was given', () => {
    const ws = createWorkspace()
    const enabled = new KonvaGraphRenderer(makeContainer(), ws)
    const disabled = new KonvaGraphRenderer(makeContainer(), ws, {
      animations: false,
    })
    try {
      expect(enabled.animations).toBe(true)
      expect(disabled.animations).toBe(false)
    } finally {
      enabled.dispose()
      disabled.dispose()
    }
  })

  it('reaches the scrollbar of a handle widget', () => {
    const enabledWs = createDisplayWorkspace()
    const display = enabledWs.addNode('Display')
    const enabled = new KonvaGraphRenderer(makeContainer(), enabledWs)
    const disabledWs = createDisplayWorkspace()
    const plain = disabledWs.addNode('Display')
    const disabled = new KonvaGraphRenderer(makeContainer(), disabledWs, {
      animations: false,
    })
    try {
      const on = enabled._store._nodeViews.get(display.id)!
      const off = disabled._store._nodeViews.get(plain.id)!
      expect(scrollbarOf(on._handleViews.get('out'))._animations).toBe(true)
      expect(scrollbarOf(off._handleViews.get('out'))._animations).toBe(false)
    } finally {
      enabled.dispose()
      disabled.dispose()
    }
  })

  it('is handed to the handle factory', () => {
    const handle = makeDisplayHandle('x'.repeat(2000))
    const off = displayHandleFactory.create!(handle, {}, {
      animations: false,
    }) as unknown as { _scrollArea: ScrollArea; destroy(): void }
    const on = displayHandleFactory.create!(handle, {}, {
      animations: true,
    }) as unknown as { _scrollArea: ScrollArea; destroy(): void }

    expect(off._scrollArea._scrollbar._animations).toBe(false)
    expect(on._scrollArea._scrollbar._animations).toBe(true)
    off.destroy()
    on.destroy()
  })
})
