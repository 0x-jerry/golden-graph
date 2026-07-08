import { HandlePosition, Node, NodeType } from '../../../src'

export class NumberNode extends Node {
  static nodeName = 'Number Input'

  constructor() {
    super()

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
