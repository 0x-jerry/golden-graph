import { HandlePosition, Node, NodeType } from '../../../src'

export class TextNode extends Node {
  static override nodeName = 'Text Input'

  constructor() {
    super()

    this.setNodeType(NodeType.Entry)

    this.addHandle({
      key: 'output',
      name: 'Text',
      position: HandlePosition.Right,
      type: 'string',
      value: 'hello',
      options: {
        type: 'text',
      },
    })
  }
}
