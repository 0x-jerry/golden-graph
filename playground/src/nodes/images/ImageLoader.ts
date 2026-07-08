import { HandlePosition, Node, NodeType } from '../../../../src'

export class ImageLoaderNode extends Node {
  static nodeName = 'Image Loader'

  constructor() {
    super()

    this.setNodeType(NodeType.Entry)

    this.addHandle({
      key: 'output',
      name: 'Image',
      position: HandlePosition.Right,
      type: 'image',
      options: {
        type: 'image',
      },
    })
  }
}
