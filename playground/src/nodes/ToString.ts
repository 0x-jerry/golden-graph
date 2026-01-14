import { sleep } from '@0x-jerry/utils'
import { HandlePosition, Node } from '../../../src'

export class ToStringNode extends Node {
  constructor() {
    super()

    this.name = 'To String'

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

    this.addHandle({
      key: 'output',
      name: 'Output',
      position: HandlePosition.Right,
      type: 'string',
    })
  }

  onProcess = async () => {
    await sleep(1000)

    const value = this.getData('input')
    this.setData('output', String(value))
  }
}
