import { HandlePosition, NodeType } from '../../../../src/core'
import type { INodeDefinition } from '../../../../src/backend'

export const imageLoaderDefinition: INodeDefinition = {
  schema: {
    type: 'ImageLoader',
    name: 'Image Loader',
    nodeType: NodeType.Entry,
    handles: [
      {
        key: 'output',
        name: 'Image',
        position: HandlePosition.Right,
        type: 'image',
        options: {
          type: 'image',
        },
      },
    ],
  },
}
