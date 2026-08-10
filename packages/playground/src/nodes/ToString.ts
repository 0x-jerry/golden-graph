import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const toStringDefinition: INodeDefinition = {
  schema: {
    name: 'To String',
    description: 'Converts the input to a string representation',
    handles: [
      {
        key: 'output',
        name: 'Output',
        position: HandlePosition.Right,
        accepts: 'string',
      },
      {
        key: 'input',
        name: 'Input',
        accepts: '*',
        position: HandlePosition.Left,
      },
      {
        value: 'This is a ToString node, and some text explanation',
        type: 'display',
      },
    ],
  },
  execute: (ctx) => {
    const value = ctx.getData('input')
    ctx.setData('output', String(value))
  },
}
