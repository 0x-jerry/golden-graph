import { HandlePosition } from '../../../src/core'
import type { INodeDefinition } from '../../../src/backend'

export const toStringDefinition: INodeDefinition = {
  schema: {
    type: 'ToString',
    name: 'To String',
    handles: [
      {
        key: 'output',
        name: 'Output',
        position: HandlePosition.Right,
        type: 'string',
      },
      {
        key: 'input',
        name: 'Input',
        type: '*',
        position: HandlePosition.Left,
      },
      {
        value: 'This is a ToString node, and some text explanation',
        options: {
          type: 'display',
        },
      },
    ],
  },
  execute: (ctx) => {
    const value = ctx.getData('input')
    ctx.setData('output', String(value))
  },
}
