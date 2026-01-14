import { HandlePosition, Node, NodeType } from '../../../src'

export class NumberNode extends Node {
  constructor() {
    super()

    this.name = 'Number Input'

    this.setNodeType(NodeType.Entry)

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
