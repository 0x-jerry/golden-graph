import { HandlePosition, Node } from '../../../../src'

export class MathOpNode extends Node {
  constructor() {
    super()

    this.name = 'Math - Op'

    this.addHandle({
      key: 's',
      name: 'Sum',
      position: HandlePosition.Right,
      type: 'number',
      value: 0,
    })

    this.addHandle({
      key: 'op',
      name: 'Op',
      value: '+',
      options: {
        type: 'select',
        options: ['+', '-', '*', '/'],
      },
    })

    this.addHandle({
      key: 'a',
      name: 'A',
      position: HandlePosition.Left,
      type: 'number',
      value: 0,
    })

    this.addHandle({
      key: 'b',
      name: 'B',
      position: HandlePosition.Left,
      type: 'number',
      value: 0,
    })
  }

  onProcess = () => {
    const a = this.getData<number>('a') ?? 0
    const b = this.getData<number>('b') ?? 0
    const op = this.getData<string>('op') ?? '+'

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

    this.setData('s', s)
  }
}
