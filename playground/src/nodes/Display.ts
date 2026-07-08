import { HandlePosition, Node } from '../../../src'

export class DisplayNode extends Node {
  static override nodeName = 'Display'

  constructor() {
    super()

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
