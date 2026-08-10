import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const mathOpDefinition: INodeDefinition = {
  schema: {
    name: 'Math - Op',
    description: 'Applies an arithmetic operation (+, -, *, /) to two numbers',
    handles: [
      {
        key: 's',
        name: 'Sum',
        position: HandlePosition.Right,
        accepts: 'number',
        value: 0,
      },
      {
        key: 'op',
        name: 'Op',
        value: '+',
        type: 'select',
        options: {
          options: ['+', '-', '*', '/'],
        },
      },
      {
        key: 'a',
        name: 'A',
        position: HandlePosition.Left,
        accepts: 'number',
        value: 0,
      },
      {
        key: 'b',
        name: 'B',
        position: HandlePosition.Left,
        accepts: 'number',
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
