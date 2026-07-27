import { HandlePosition } from '../../../../src/core'
import type { INodeDefinition } from '../../../../src/backend'

export const mathOpDefinition: INodeDefinition = {
  schema: {
    type: 'Math.Op',
    name: 'Math - Op',
    handles: [
      {
        key: 's',
        name: 'Sum',
        position: HandlePosition.Right,
        type: 'number',
        value: 0,
      },
      {
        key: 'op',
        name: 'Op',
        value: '+',
        options: {
          type: 'select',
          options: ['+', '-', '*', '/'],
        },
      },
      {
        key: 'a',
        name: 'A',
        position: HandlePosition.Left,
        type: 'number',
        value: 0,
      },
      {
        key: 'b',
        name: 'B',
        position: HandlePosition.Left,
        type: 'number',
        value: 0,
      },
    ],
  },
  execute: (ctx) => {
    const a = ctx.getData<number>('a') ?? 0
    const b = ctx.getData<number>('b') ?? 0
    const op = ctx.getData<string>('op') ?? '+'

    let s = 0
    if (op === '+') {
      s = a + b
    } else if (op === '-') {
      s = a - b
    } else if (op === '*') {
      s = a * b
    } else if (op === '/') {
      s = a / b
    }

    ctx.setData('s', s)
  },
}
