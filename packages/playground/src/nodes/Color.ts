import { HandlePosition, NodeType } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const colorDefinition: INodeDefinition = {
  schema: {
    name: 'Color Input',
    description: 'Emits a constant color value',
    nodeType: NodeType.Entry,
    handles: [
      {
        key: 'output',
        name: 'Color',
        position: HandlePosition.Right,
        accepts: 'string',
        value: '#6366f1',
        type: 'color',
      },
    ],
  },
}
