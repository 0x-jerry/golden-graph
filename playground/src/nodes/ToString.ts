import { HandlePosition, Node } from '../../../src'

export class ToStringNode extends Node {
  constructor() {
    super()

    this.name = 'To String'

    this.addHandle({
      key: 'output',
      name: 'Output',
      position: HandlePosition.Right,
      type: 'string',
    })

    this.addHandle({
      key: 'input',
      name: 'Input',
      type: '*',
      position: HandlePosition.Left,
    })

    this.addHandle({
      options: {
        type: 'text',
        content: 'This is a ToString node, and some text explanation',
      },
    })
  }

  onProcess = () => {
    const value = this.getData('input')
    this.setData('output', String(value))
  }
}
