import { HandlePosition, NodeType } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const textDefinition: INodeDefinition = {
  schema: {
    name: 'Text Input',
    description: 'Emits a constant string value',
    nodeType: NodeType.Entry,
    handles: [
      {
        key: 'output',
        name: 'Text',
        position: HandlePosition.Right,
        accepts: 'string',
        value: 'hello',
        type: 'text',
      },
    ],
  },
}
