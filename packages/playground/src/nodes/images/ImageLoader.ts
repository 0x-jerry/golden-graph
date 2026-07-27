import { HandlePosition, NodeType } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

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
