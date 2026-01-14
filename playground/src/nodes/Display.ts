import { HandlePosition, Node } from '../../../src'

export class DisplayNode extends Node {
  constructor() {
    super()

    this.name = 'Display'

    this.addHandle({
      key: 'input',
      name: 'Input',
      position: HandlePosition.Left,
      type: '*',
      value: '',
      options: {
        type: 'display',
      },
    })
  }
}
