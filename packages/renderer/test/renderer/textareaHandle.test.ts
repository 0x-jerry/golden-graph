import { describe, it, expect } from 'vitest'
import {
  HandlePosition,
  Workspace,
} from '@0x-jerry/golden-graph'
import type { INodeSchema, NodeHandle } from '@0x-jerry/golden-graph'
import {
  textareaHandleFactory,
  TEXTAREA_MIN_HEIGHT,
} from '../../src/renderer/handles/TextareaHandle'
import { getHandleRowHeight } from '../../src/renderer/handles/layout'
import { getHandleFactory } from '../../src/renderer/handles'
import { addHandle, makeNode } from '../helpers/entities'
import { LAYOUT } from '../../src/renderer/constants'
import type { Textarea } from '../../src/renderer/components/text'

function makeHandle(value = ''): NodeHandle {
  const schema: INodeSchema = {
    type: 'Textarea',
    name: 'Textarea',
    handles: [
      {
        key: 'value',
        name: 'Value',
        type: 'textarea',
        position: HandlePosition.Left,
        value,
      },
    ],
  }
  const ws = new Workspace()
  ws.registerNodeSchema(schema)
  return ws.addNode('Textarea').getHandle('value')!
}

describe('textarea handle', () => {
  it('is a block handle with the configured content box', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a', { type: 'textarea' })
    expect(getHandleRowHeight(node.getHandle('a')!)).toBe(
      LAYOUT.HANDLE_ROW_HEIGHT + TEXTAREA_MIN_HEIGHT,
    )
  })

  it('exposes the minHeight as its content box', () => {
    const factory = getHandleFactory('textarea')!
    expect(factory.config?.layout).toBe('block')
    expect(factory.config?.minHeight).toBe(TEXTAREA_MIN_HEIGHT)
  })

  it('writes the edited value back to the handle', () => {
    const handle = makeHandle('')
    const module = textareaHandleFactory.create!(
      handle,
      {},
      undefined,
    ) as unknown as {
      _textarea: Textarea
      destroy(): void
    }
    module._textarea.setValue('hello')
    expect(handle.getValue()).toBe('hello')
    module.destroy()
  })
})
