import { HandlePosition, NodeType } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const imageLoaderDefinition: INodeDefinition = {
  schema: {
    name: 'Image Loader',
    description: 'Loads an image and emits it as an image value',
    nodeType: NodeType.Entry,
    handles: [
      {
        key: 'output',
        name: 'Image',
        position: HandlePosition.Right,
        accepts: 'image',
        type: 'image',
      },
    ],
  },
}
