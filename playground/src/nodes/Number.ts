import { HandlePosition, Node } from '../../../src/core'

export class NumberNode extends Node {
  constructor() {
    super()

    this.name = 'Number Input'

    this.addHandle({
      key: 'output',
      name: 'Number',
      position: HandlePosition.Right,
      type: 'number',
      value: 10,
      options: {
        type: 'number',
      },
    })
  }
}
